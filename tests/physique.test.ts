/**
 * @jest-environment node
 */
import { createTestDb } from './helpers/nodeDb';
import { migrate, profilesRepo } from '@/database';
import { bodyMetricsRepo } from '@/database/repositories/bodyMetrics';
import { workoutsRepo } from '@/database/repositories/workouts';
import { templatesRepo } from '@/database/repositories/templates';
import { computeMuscleRanks, epley1RM, rankFromScore, rankUps, scoreFrom, type PhysiqueSet } from '@/features/physique/physique';
import { STANDARDS, standardFor } from '@/features/physique/standards';
import { getLibraryExercise } from '@/features/exercises/library';
import { DEFAULT_TEMPLATES } from '@/features/training/defaultPlan';
import { ensureDefaultPlan, startFromTemplate } from '@/services/plan';
import { finishWorkout } from '@/services/workoutSession';
import { computePhysique } from '@/services/physique';

const now = new Date('2026-11-20T15:00:00Z');
const set = (libraryId: string, kg: number, reps: number, daysAgo = 1, primary = getLibraryExercise(libraryId)!.primary): PhysiqueSet => ({
  libraryId,
  primary,
  performedAt: new Date(now.getTime() - daysAgo * 86_400_000).toISOString(),
  completed: true,
  repetitions: reps,
  effectiveKg: kg,
  durationSeconds: null,
});

describe('puntuación y ranks', () => {
  it('umbrales → E, D, C, B, A, S', () => {
    const t = [0.5, 0.75, 1.25, 1.75, 2.0];
    expect(rankFromScore(scoreFrom(0.4, t))).toBe('E');
    expect(rankFromScore(scoreFrom(0.5, t))).toBe('D');
    expect(rankFromScore(scoreFrom(1.0, t))).toBe('C');
    expect(rankFromScore(scoreFrom(1.25, t))).toBe('B');
    expect(rankFromScore(scoreFrom(1.8, t))).toBe('A');
    expect(rankFromScore(scoreFrom(2.1, t))).toBe('S');
    expect(scoreFrom(10, t)).toBe(6);
    expect(epley1RM(100, 10)).toBeCloseTo(133.33, 1);
  });

  it('todos los ejercicios del plan tienen estándar salvo la máquina de palanca', () => {
    const ids = DEFAULT_TEMPLATES.flatMap((t) => t.exercises.map((e) => e.exerciseId));
    const missing = ids.filter((id) => !standardFor(id));
    // Core sin carga ni tiempo (curl-up, bird-dog, dead bug, puente) no tienen tabla.
    expect(missing.sort()).toEqual(['ek-9301', 'ek-9302', 'ek-9303', 'ek-9305']);
    expect(standardFor('ek-9307')).toBeNull();
    for (const s of Object.values(STANDARDS)) {
      const t = s.type === 'time' ? s.seconds : s.ratios;
      for (let i = 1; i < 5; i++) expect(t[i]!).toBeGreaterThan(t[i - 1]!);
    }
  });

  it('press de banca 80 kg × 8 con 84 kg de peso → C (novato–intermedio) y pista para B', () => {
    const [chest] = computeMuscleRanks([set('ek-0042', 80, 8)], 84, now);
    // 1RM ≈ 101,3 kg → 1,21 × peso corporal: entre 0,75 y 1,25
    expect(chest).toMatchObject({ muscle: 'chest', rank: 'C', approx: false, bestLibraryId: 'ek-0042' });
    // B pide 1,25 × 84 = 105 kg de 1RM → ~83 kg × 8
    expect(chest!.next).toEqual({ rank: 'B', kind: 'kg', kg: 83, reps: 8 });
  });

  it('el músculo toma su mejor ejercicio; series de >15 reps o fuera de 90 días no cuentan', () => {
    const ranks = computeMuscleRanks(
      [set('ek-0211', 20, 10), set('ek-0211', 60, 10, 120), set('ek-0223', 18, 10), set('ek-0211', 40, 20)],
      84,
      now,
    );
    const biceps = ranks.find((r) => r.muscle === 'biceps')!;
    // Alterno 18 kg × 10 = 0,29 × peso (B) supera al curl con barra 20 × 10 = 0,32 × peso (D en su escala).
    expect(biceps.bestLibraryId).toBe('ek-0223');
  });

  it('la máquina de palanca no da rank; bajada tras 6 semanas sin entrenar', () => {
    expect(computeMuscleRanks([set('ek-9307', 100, 10)], 84, now)).toEqual([]);
    const [fresh] = computeMuscleRanks([set('ek-0042', 80, 8, 10)], 84, now);
    const [old] = computeMuscleRanks([set('ek-0042', 80, 8, 50)], 84, now);
    expect(fresh!.rank).toBe('C');
    expect(old).toMatchObject({ rank: 'D', decayed: true });
  });

  it('plancha por tiempo', () => {
    const plank: PhysiqueSet = { ...set('ek-9304', 0, 0), effectiveKg: null, repetitions: null, durationSeconds: 60 };
    expect(computeMuscleRanks([plank], 84, now)[0]).toMatchObject({ muscle: 'core', rank: 'C', next: { rank: 'B', kind: 'seconds', seconds: 90 } });
  });

  it('detecta subidas de rank para la animación', () => {
    const before = computeMuscleRanks([set('ek-0042', 40, 8)], 84, now); // 0,60 × peso → D
    const after = computeMuscleRanks([set('ek-0042', 80, 8), set('ek-0211', 30, 10)], 84, now);
    expect(rankUps(before, after)).toEqual([
      { muscle: 'chest', from: 'D', to: 'C' },
      { muscle: 'biceps', from: null, to: 'C' },
    ]);
  });
});

describe('ficha de personaje desde la base de datos', () => {
  it('sin peso confirmado no inventa ranks; con peso calcula ranks y radar', async () => {
    const db = createTestDb();
    await migrate(db);
    const profileId = (await profilesRepo.create(db, { displayName: 'Test', heightCm: 175 })).id;
    await ensureDefaultPlan(db, profileId);
    const push = (await templatesRepo.list(db, profileId)).find((t) => t.name === 'Pecho y tríceps')!;
    const w = await startFromTemplate(db, profileId, push.id);
    for (const s of (await workoutsRepo.listSets(db, w.id)).filter((x) => x.exerciseId === 'ek-0042')) {
      await workoutsRepo.updateSet(db, s.id, { repetitions: 8, weightKg: 80, completed: true });
    }
    await finishWorkout(db, w.id);
    expect((await computePhysique(db, profileId)).ranks).toEqual([]);
    await bodyMetricsRepo.create(db, profileId, { measuredAt: new Date().toISOString(), weightKg: 84, source: 'manual' });
    const p = await computePhysique(db, profileId);
    expect(p.ranks.map((r) => [r.muscle, r.rank])).toEqual([['chest', 'C']]);
    expect(p.stats.fuerza).toBeGreaterThan(0);
    expect(p.stats.acondicionamiento).toBe(0); // sin caminadora en 7 días
    db.close();
  });
});
