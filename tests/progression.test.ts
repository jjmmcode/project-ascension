/**
 * @jest-environment node
 */
import { createTestDb } from './helpers/nodeDb';
import { migrate, profilesRepo } from '@/database';
import { bodyMetricsRepo } from '@/database/repositories/bodyMetrics';
import { workoutsRepo } from '@/database/repositories/workouts';
import { templatesRepo } from '@/database/repositories/templates';
import { ensureDefaultPlan, startFromTemplate } from '@/services/plan';
import { finishWorkout } from '@/services/workoutSession';
import { claimWeakMission, evaluateRank, getPassedRank, weakMission } from '@/services/progression';
import { awardXp, totalXp } from '@/services/xp';
import { evaluateExams, examStatus, nextRank, RANK_EXAMS } from '@/features/progression/exams';
import { GENERAL_RANKS, totalXpForLevel, type MuscleRankLetter } from '@/features/progression/leveling';
import type { MuscleGroup } from '@/features/exercises/library';
import { PHYSIQUE_MUSCLES } from '@/services/physique';

const muscles = (ranks: MuscleRankLetter[]) =>
  ranks.map((rank, i) => ({ muscle: PHYSIQUE_MUSCLES[i] as MuscleGroup, rank, score: 'EDCBAS'.indexOf(rank) + 0.5 }));

describe('examen de rango', () => {
  it('9 rangos hasta SSS+, cada uno con examen', () => {
    expect(GENERAL_RANKS).toEqual(['E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS', 'SSS+']);
    for (const r of GENERAL_RANKS.slice(1)) expect(RANK_EXAMS[r]?.length).toBeGreaterThan(0);
    expect(nextRank('SSS')).toBe('SSS+');
    expect(nextRank('SSS+')).toBeNull();
  });

  it('nivel sin fuerza no basta: el examen queda pendiente con los músculos más cercanos', () => {
    const m = muscles(['D', 'D', 'D', 'D', 'D', 'E', 'E']);
    const st = examStatus('D', 12, m, PHYSIQUE_MUSCLES);
    expect(st).toMatchObject({ levelOk: true, ready: false });
    expect(st.requirements[0]).toMatchObject({ have: 5, count: 6, ok: false });
    expect(st.requirements[0]!.closest[0]).toBe(PHYSIQUE_MUSCLES[5]); // E con más puntuación que los sin datos
  });

  it('aprueba en orden varios exámenes si se cumplen y se detiene en el primero que falla', () => {
    // Cada rango pide músculos de su misma letra: 6 en B aprueban D, C y B
    const m = muscles(['B', 'B', 'B', 'B', 'B', 'B', 'C']);
    const r = evaluateExams('E', 35, m, PHYSIQUE_MUSCLES);
    expect(r.newlyPassed).toEqual(['D', 'C', 'B']);
    expect(r.passed).toBe('B');
    expect(r.next).toMatchObject({ rank: 'A', levelOk: false, ready: false }); // A pide nivel 45
  });

  it('SSS+ exige los 11 músculos en S (élite); SS y SSS, 8 y 10', () => {
    const all: MuscleRankLetter[] = Array(11).fill('S');
    all[10] = 'A';
    expect(examStatus('SSS+', 100, muscles(all), PHYSIQUE_MUSCLES).ready).toBe(false);
    expect(examStatus('SSS', 90, muscles(all), PHYSIQUE_MUSCLES).ready).toBe(true);
    all[10] = 'S';
    expect(examStatus('SSS+', 100, muscles(all), PHYSIQUE_MUSCLES).ready).toBe(true);
    const eight: MuscleRankLetter[] = [...Array(8).fill('S'), 'A', 'A', 'A'];
    expect(examStatus('SS', 75, muscles(eight), PHYSIQUE_MUSCLES).ready).toBe(true);
    expect(examStatus('SSS', 90, muscles(eight), PHYSIQUE_MUSCLES).ready).toBe(false);
  });
});

describe('servicio de progresión', () => {
  let db: ReturnType<typeof createTestDb>;
  let profileId: string;
  beforeEach(async () => {
    db = createTestDb();
    await migrate(db);
    profileId = (await profilesRepo.create(db, { displayName: 'Test', heightCm: 175 })).id;
    await ensureDefaultPlan(db, profileId);
    await bodyMetricsRepo.create(db, profileId, { measuredAt: new Date().toISOString(), weightKg: 84, source: 'manual' });
  });
  afterEach(() => db.close());

  it('el rango aprobado se guarda, da XP una vez y no baja', async () => {
    expect(await getPassedRank(db, profileId)).toBe('E');
    // Nivel 10 sin músculos: pendiente
    let n = 0;
    while ((await totalXp(db, profileId)) < totalXpForLevel(10)) {
      await awardXp(db, { profileId, source: 'workout', sourceId: `x${n}`, idempotencyKey: `x${n}`, at: new Date(Date.UTC(2026, 0, 1 + n)) });
      n++;
    }
    let ev = await evaluateRank(db, profileId);
    expect(ev.passed).toBe('E');
    expect(ev.next).toMatchObject({ rank: 'D', levelOk: true, ready: false });
    // 4 músculos en D o más: pecho, espalda (remo), hombros (laterales), bíceps
    const push = (await templatesRepo.list(db, profileId)).find((t) => t.name === 'Bíceps y espalda')!;
    const w = await startFromTemplate(db, profileId, push.id);
    const strong: Record<string, number> = { 'ek-0211': 30, 'ek-0024': 30, 'ek-0025': 60, 'ek-0097': 60 };
    for (const s of await workoutsRepo.listSets(db, w.id)) {
      if (strong[s.exerciseId]) await workoutsRepo.updateSet(db, s.id, { repetitions: 10, weightKg: strong[s.exerciseId]!, completed: true });
    }
    await finishWorkout(db, w.id);
    const xp0 = await totalXp(db, profileId);
    ev = await evaluateRank(db, profileId);
    // bíceps y espalda solos no llegan a 4 músculos
    expect(ev.passed).toBe('E');
    const sh = (await templatesRepo.list(db, profileId)).find((t) => t.name === 'Hombro y antebrazo')!;
    await db.runAsync(`UPDATE workouts SET started_at = ? WHERE id = ?`, [new Date(Date.now() - 86_400_000).toISOString(), w.id]);
    const w2 = await startFromTemplate(db, profileId, sh.id);
    const strong2: Record<string, number> = { 'ek-0018': 10, 'ek-0257': 10 };
    for (const s of await workoutsRepo.listSets(db, w2.id)) {
      if (strong2[s.exerciseId]) await workoutsRepo.updateSet(db, s.id, { repetitions: 12, weightKg: strong2[s.exerciseId]!, completed: true });
    }
    await finishWorkout(db, w2.id);
    ev = await evaluateRank(db, profileId);
    // 4 músculos: el examen D pide 6
    expect(ev.passed).toBe('E');
    await db.runAsync(`UPDATE workouts SET started_at = ? WHERE id = ?`, [new Date(Date.now() - 2 * 86_400_000).toISOString(), w2.id]);
    const ch = (await templatesRepo.list(db, profileId)).find((t) => t.name === 'Pecho y tríceps')!;
    const w3 = await startFromTemplate(db, profileId, ch.id);
    const strong3: Record<string, number> = { 'ek-0042': 60, 'ek-0194': 25 };
    for (const s of await workoutsRepo.listSets(db, w3.id)) {
      if (strong3[s.exerciseId]) await workoutsRepo.updateSet(db, s.id, { repetitions: 10, weightKg: strong3[s.exerciseId]!, completed: true });
    }
    await finishWorkout(db, w3.id);
    ev = await evaluateRank(db, profileId);
    expect(ev.newlyPassed).toEqual(['D']);
    expect(await getPassedRank(db, profileId)).toBe('D');
    expect((await totalXp(db, profileId)) - xp0).toBeGreaterThanOrEqual(200);
    const again = await evaluateRank(db, profileId);
    expect(again.newlyPassed).toEqual([]);
  });

  it('misión semanal: elige el músculo más débil, cuenta series y paga una vez', async () => {
    const m0 = await weakMission(db, profileId);
    expect(m0.sets).toBe(0);
    expect(m0.rank).toBeNull();
    // Se mantiene toda la semana aunque cambien los ranks
    expect((await weakMission(db, profileId)).muscle).toBe(m0.muscle);
    expect(await claimWeakMission(db, profileId, m0)).toBe(false);
    expect(m0.suggestions.length).toBeGreaterThan(0);
    const done = { ...m0, sets: 10, done: true };
    expect(await claimWeakMission(db, profileId, done)).toBe(true);
    expect(await claimWeakMission(db, profileId, done)).toBe(false);
    expect((await weakMission(db, profileId)).rewarded).toBe(true);
  });
});
