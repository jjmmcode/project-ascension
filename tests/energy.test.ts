/**
 * @jest-environment node
 */
import { createTestDb } from './helpers/nodeDb';
import { migrate, profilesRepo } from '@/database';
import { bodyMetricsRepo } from '@/database/repositories/bodyMetrics';
import { workoutsRepo } from '@/database/repositories/workouts';
import { chooseMet, estimateWorkoutEnergy, volumeLoadKg, type EnergySet } from '@/features/training/energy';
import { ensureDefaultPlan, startFromTemplate } from '@/services/plan';
import { templatesRepo } from '@/database/repositories/templates';
import { backfillWorkoutEnergy, finishWorkout, recomputeWorkoutEnergy } from '@/services/workoutSession';

const sets = (n: number, primary: EnergySet['primary'] = ['biceps'], id = 'ek-0211'): EnergySet[] =>
  Array.from({ length: n }, () => ({ exerciseId: id, completed: true, primary }));

describe('estimación de kcal (Compendio 2024)', () => {
  it('reproduce el estudio de validación: ~165 kcal netas para 84 kg y 45 min a 3,5 MET', () => {
    const e = estimateWorkoutEnergy({
      startedAt: '2026-11-19T22:00:00Z',
      finishedAt: '2026-11-19T22:45:00Z',
      bodyweightKg: 84,
      sets: sets(21),
    })!;
    expect(e.met).toBe(3.5);
    expect(e.kcal).toBe(165); // (3,5 − 1) × 3,5 × 84 / 200 × 45 = 165,4
    expect([e.low, e.high]).toEqual([130, 200]);
    expect(e.capped).toBe(false);
  });

  it('elige el MET según la sesión', () => {
    expect(chooseMet(sets(32), 60).met).toBe(3.5); // tu martes: 32 series en 60 min
    expect(chooseMet(sets(40), 60).met).toBe(6.0); // 0,67 series/min: vigorosa
    expect(chooseMet([...sets(12, ['quads', 'glutes'], 'ek-0127'), ...sets(8, ['quads'], 'ek-0142')], 60).met).toBe(5.0);
    expect(chooseMet([...sets(8, ['quads', 'glutes'], 'ek-0127'), ...sets(12, ['quads'], 'ek-0142')], 60).met).toBe(3.5);
  });

  it('recorta la duración si la sesión quedó abierta', () => {
    const e = estimateWorkoutEnergy({
      startedAt: '2026-11-19T20:00:00Z',
      finishedAt: '2026-11-20T02:00:00Z',
      bodyweightKg: 84,
      sets: sets(10),
    })!;
    expect(e.minutes).toBe(50);
    expect(e.capped).toBe(true);
  });

  it('sin series, duración o peso no estima', () => {
    expect(estimateWorkoutEnergy({ startedAt: 'a', finishedAt: 'b', bodyweightKg: 84, sets: sets(3) })).toBeNull();
    expect(estimateWorkoutEnergy({ startedAt: '2026-11-19T20:00:00Z', finishedAt: '2026-11-19T21:00:00Z', bodyweightKg: 0, sets: sets(3) })).toBeNull();
  });

  it('volumen: kg × reps de las series hechas, con carga efectiva en dominadas', () => {
    expect(
      volumeLoadKg([
        { completed: true, repetitions: 10, loadMode: 'external', weightKg: 20, assistanceKg: null, bodyweightKg: null },
        { completed: false, repetitions: 10, loadMode: 'external', weightKg: 20, assistanceKg: null, bodyweightKg: null },
        { completed: true, repetitions: 8, loadMode: 'assisted', weightKg: null, assistanceKg: 30, bodyweightKg: 84 },
      ]),
    ).toBe(200 + 8 * 54);
  });
});

describe('kcal al terminar la sesión', () => {
  let db: ReturnType<typeof createTestDb>;
  let profileId: string;
  beforeEach(async () => {
    db = createTestDb();
    await migrate(db);
    profileId = (await profilesRepo.create(db, { displayName: 'Test', heightCm: 175 })).id;
    await ensureDefaultPlan(db, profileId);
  });
  afterEach(() => db.close());

  const run = async () => {
    const pull = (await templatesRepo.list(db, profileId)).find((t) => t.name === 'Bíceps y espalda')!;
    const w = await startFromTemplate(db, profileId, pull.id);
    await db.runAsync(`UPDATE workouts SET started_at = ? WHERE id = ?`, [new Date(Date.now() - 60 * 60_000).toISOString(), w.id]);
    for (const s of (await workoutsRepo.listSets(db, w.id)).slice(0, 20)) {
      await workoutsRepo.updateSet(db, s.id, { repetitions: 10, weightKg: 20, completed: true });
    }
    return finishWorkout(db, w.id);
  };

  it('sin peso reciente no inventa: pide el peso y luego recalcula', async () => {
    const r = await run();
    expect(r.energy).toBeNull();
    // 16 series × 200 kg; las 4 de dominadas no suman sin peso corporal (carga efectiva desconocida)
    expect(r.volumeKg).toBe(16 * 200);
    await bodyMetricsRepo.create(db, profileId, { measuredAt: new Date().toISOString(), weightKg: 84, source: 'manual' });
    const e = await recomputeWorkoutEnergy(db, r.workout.id);
    expect(e?.kcal).toBeGreaterThan(200);
    expect((await workoutsRepo.getById(db, r.workout.id))?.energyKcal).toBe(e?.kcal);
  });

  it('con peso confirmado guarda las kcal en la sesión', async () => {
    await bodyMetricsRepo.create(db, profileId, { measuredAt: new Date().toISOString(), weightKg: 84, source: 'manual' });
    const r = await run();
    // 60 min a 3,5 MET y 84 kg ≈ 220 kcal netas
    expect(r.energy?.kcal).toBe(220);
    expect(r.workout.energyMet).toBe(3.5);
  });

  it('calcula sesiones anteriores con el peso confirmado más cercano a su fecha', async () => {
    const r = await run(); // sin peso: queda pendiente
    expect(r.energy).toBeNull();
    expect(await backfillWorkoutEnergy(db, profileId)).toBe(0);
    // Un peso de hace 40 días no sirve; uno estimado tampoco.
    await bodyMetricsRepo.create(db, profileId, { measuredAt: new Date(Date.now() - 40 * 86_400_000).toISOString(), weightKg: 90, source: 'manual' });
    await bodyMetricsRepo.create(db, profileId, { measuredAt: new Date().toISOString(), weightKg: 70, source: 'manual', dataStatus: 'estimated' });
    expect(await backfillWorkoutEnergy(db, profileId)).toBe(0);
    await bodyMetricsRepo.create(db, profileId, { measuredAt: new Date().toISOString(), weightKg: 84, source: 'manual' });
    expect(await backfillWorkoutEnergy(db, profileId)).toBe(1);
    expect((await workoutsRepo.getById(db, r.workout.id))?.energyKcal).toBe(220);
    expect(await backfillWorkoutEnergy(db, profileId)).toBe(0); // idempotente
    const recent = await workoutsRepo.listRecentCompleted(db, profileId);
    expect(recent[0]).toMatchObject({ templateName: 'Bíceps y espalda', completedSets: 20, energyKcal: 220 });
  });
});
