/**
 * @jest-environment node
 */
import { createTestDb } from './helpers/nodeDb';
import { migrate, profilesRepo } from '@/database';
import { templatesRepo } from '@/database/repositories/templates';
import { ensureExercise, workoutsRepo } from '@/database/repositories/workouts';
import { findOption } from '@/features/training/exerciseOptions';
import { applyPlanUpdates, ensureDefaultPlan, isoWeekday, swapSessionExercise, sessionTargets, startFromTemplate, todayPlan, weeklySetsByMuscle } from '@/services/plan';
import { finishWorkout } from '@/services/workoutSession';
import { DEFAULT_TEMPLATES, firstNumber } from '@/features/training/defaultPlan';
import { getLibraryExercise } from '@/features/exercises/library';

let db: ReturnType<typeof createTestDb>;
let profileId: string;

beforeEach(async () => {
  db = createTestDb();
  await migrate(db);
  profileId = (await profilesRepo.create(db, { displayName: 'Test', heightCm: 175 })).id;
});
afterEach(() => db.close());

describe('plan semanal', () => {
  it('todos los ejercicios del plan existen en la biblioteca', () => {
    for (const t of DEFAULT_TEMPLATES) for (const e of t.exercises) expect(getLibraryExercise(e.exerciseId)).not.toBeNull();
  });

  it('siembra rutinas y días una sola vez', async () => {
    expect(await ensureDefaultPlan(db, profileId)).toBe(true);
    expect(await ensureDefaultPlan(db, profileId)).toBe(false);
    const list = await templatesRepo.list(db, profileId);
    expect(list.map((t) => t.name)).toEqual(DEFAULT_TEMPLATES.map((t) => t.name));
    const schedule = await templatesRepo.schedule(db, profileId);
    const name = (id: string | null) => list.find((t) => t.id === id)?.name ?? null;
    expect(schedule.map((d) => name(d.templateId))).toEqual([
      'Pecho y tríceps', 'Bíceps y espalda', 'Core y zona lumbar', 'Hombro y antebrazo', 'Pierna', 'Cardio: caminadora', 'Cardio: caminadora',
    ]);
    expect((await profilesRepo.getById(db, profileId))?.birthYear).toBeNull(); // no se inventa: lo pone el usuario
  });

  it('si el usuario borra una rutina no se vuelve a crear y su día queda libre', async () => {
    await ensureDefaultPlan(db, profileId);
    const legs = (await templatesRepo.list(db, profileId)).find((t) => t.name === 'Pierna')!;
    await templatesRepo.remove(db, legs.id);
    await ensureDefaultPlan(db, profileId);
    expect((await templatesRepo.list(db, profileId)).some((t) => t.name === 'Pierna')).toBe(false);
    expect((await templatesRepo.schedule(db, profileId))[4]!.templateId).toBeNull();
  });

  it('isoWeekday usa la fecha local de Santiago (lunes = 1, domingo = 7)', () => {
    expect(isoWeekday(new Date('2026-11-16T15:00:00Z'))).toBe(1);
    expect(isoWeekday(new Date('2026-11-23T02:00:00Z'))).toBe(7); // domingo 22 a las 23:00 en Santiago
    expect(firstNumber('10–12')).toBe(10);
    expect(firstNumber('30–45 s')).toBe(30);
  });

  it('empezar la rutina de hoy crea las series con objetivos y el peso de la última vez', async () => {
    await ensureDefaultPlan(db, profileId);
    const tuesday = new Date('2026-11-17T15:00:00Z');
    const today = await todayPlan(db, profileId, tuesday);
    expect(today.template?.name).toBe('Bíceps y espalda');

    const w1 = await startFromTemplate(db, profileId, today.template!.id);
    const sets1 = await workoutsRepo.listSets(db, w1.id);
    expect(sets1).toHaveLength(32);
    const curl = sets1.filter((s) => s.exerciseId === 'ek-0211');
    expect(curl.map((s) => s.repetitions)).toEqual([10, 10, 10, 10]);
    for (const [i, s] of curl.entries()) {
      await workoutsRepo.updateSet(db, s.id, { repetitions: 10, weightKg: 20 + i * 2.5, completed: true });
    }
    expect((await sessionTargets(db, w1)).get('ek-0211')?.target).toBe('10');
    await finishWorkout(db, w1.id, tuesday);

    const w2 = await startFromTemplate(db, profileId, today.template!.id);
    const curl2 = (await workoutsRepo.listSets(db, w2.id)).filter((s) => s.exerciseId === 'ek-0211');
    expect(curl2.map((s) => s.weightKg)).toEqual([20, 22.5, 25, 27.5]);
    expect(curl2.every((s) => !s.completed)).toBe(true);
  });

  it('las planchas se registran en segundos', async () => {
    await ensureDefaultPlan(db, profileId);
    const core = (await templatesRepo.list(db, profileId)).find((t) => t.name === 'Core y zona lumbar')!;
    const w = await startFromTemplate(db, profileId, core.id);
    const plank = (await workoutsRepo.listSets(db, w.id)).filter((s) => s.exerciseId === 'ek-9304');
    expect(plank.map((s) => [s.exerciseType, s.durationSeconds, s.repetitions])).toEqual([
      ['time', 30, null], ['time', 30, null], ['time', 30, null],
    ]);
    await expect(workoutsRepo.updateSet(db, plank[0]!.id, { repetitions: null, weightKg: null, durationSeconds: -5, completed: true })).rejects.toThrow();
  });

  it('cuenta las series semanales por músculo principal de las sesiones terminadas', async () => {
    await ensureDefaultPlan(db, profileId);
    const pull = (await templatesRepo.list(db, profileId)).find((t) => t.name === 'Bíceps y espalda')!;
    const now = new Date();
    const w = await startFromTemplate(db, profileId, pull.id);
    const sets = await workoutsRepo.listSets(db, w.id);
    for (const s of sets.filter((x) => x.exerciseId === 'ek-0211' || x.exerciseId === 'ek-0024')) {
      await workoutsRepo.updateSet(db, s.id, { repetitions: 10, weightKg: 20, completed: true });
    }
    expect(await weeklySetsByMuscle(db, profileId, now)).toEqual({});
    await finishWorkout(db, w.id, now);
    expect(await weeklySetsByMuscle(db, profileId, now)).toEqual({ biceps: 4, back: 4 });
  });

  it('editar la rutina: objetivo, orden y quitar', async () => {
    await ensureDefaultPlan(db, profileId);
    const push = (await templatesRepo.list(db, profileId)).find((t) => t.name === 'Pecho y tríceps')!;
    const [a, b] = await templatesRepo.exercises(db, push.id);
    await templatesRepo.updateExercise(db, a!.id, { sets: 5, target: '8', notes: null });
    await templatesRepo.move(db, a!.id, 1);
    let list = await templatesRepo.exercises(db, push.id);
    expect(list.slice(0, 2).map((e) => [e.exerciseId, e.sets, e.target])).toEqual([[b!.exerciseId, 4, '12'], [a!.exerciseId, 5, '8']]);
    await expect(templatesRepo.updateExercise(db, a!.id, { sets: 0, target: '8' })).rejects.toThrow();
    await templatesRepo.removeExercise(db, a!.id);
    list = await templatesRepo.exercises(db, push.id);
    expect(list).toHaveLength(4);
  });
});

describe('siembra concurrente', () => {
  it('dos refrescos simultáneos no duplican las rutinas', async () => {
    await Promise.all([ensureDefaultPlan(db, profileId), ensureDefaultPlan(db, profileId)]);
    expect(await templatesRepo.list(db, profileId)).toHaveLength(DEFAULT_TEMPLATES.length);
  });
});

describe('cambio de ejercicio y ajustes del 19-11-2026', () => {
  it('cambiar ejercicio conserva series y el objetivo de la rutina', async () => {
    await ensureDefaultPlan(db, profileId);
    const sh = (await templatesRepo.list(db, profileId)).find((t) => t.name === 'Hombro y antebrazo')!;
    const w = await startFromTemplate(db, profileId, sh.id);
    const press = (await workoutsRepo.listSets(db, w.id)).filter((s) => s.exerciseId === 'ek-0004');
    await workoutsRepo.updateSet(db, press[0]!.id, { repetitions: 10, weightKg: 20, completed: true });
    await swapSessionExercise(db, w.id, 'ek-0004', 'ek-9307');
    const after = (await workoutsRepo.listSets(db, w.id)).filter((s) => s.exerciseId === 'ek-9307');
    expect(after.map((s) => [s.setNumber, s.weightKg, s.completed, s.plannedExerciseId])).toEqual([
      [1, 20, true, 'ek-0004'], [2, null, false, 'ek-0004'], [3, null, false, 'ek-0004'], [4, null, false, 'ek-0004'],
    ]);
    expect((await sessionTargets(db, w)).get('ek-9307')?.target).toBe('10');
    const extra = await workoutsRepo.addSet(db, w.id, 'ek-9307');
    expect(extra.plannedExerciseId).toBe('ek-0004');
    await expect(swapSessionExercise(db, w.id, 'ek-9307', 'ek-0018')).rejects.toThrow(/ya está/);
  });

  it('añade la elevación frontal tras las laterales y corrige el press del 19-11 una sola vez', async () => {
    // Plan creado antes del cambio: sin elevación frontal.
    await ensureDefaultPlan(db, profileId);
    const sh = (await templatesRepo.list(db, profileId)).find((t) => t.name === 'Hombro y antebrazo')!;
    const front = (await templatesRepo.exercises(db, sh.id)).find((e) => e.exerciseId === 'ek-9308')!;
    await templatesRepo.removeExercise(db, front.id);

    const w = await workoutsRepo.start(db, profileId, sh.id);
    await db.runAsync(`UPDATE workouts SET started_at = '2026-11-19T22:30:00.000Z' WHERE id = ?`, [w.id]);
    const opt = findOption('ek-0004')!;
    await ensureExercise(db, opt.ref);
    await workoutsRepo.addSet(db, w.id, 'ek-0004', { repetitions: 10, weightKg: 20, completed: true });

    await applyPlanUpdates(db, profileId);
    await applyPlanUpdates(db, profileId);
    const ids = (await templatesRepo.exercises(db, sh.id)).map((e) => e.exerciseId);
    expect(ids.slice(0, 3)).toEqual(['ek-0004', 'ek-0018', 'ek-9308']);
    expect(ids.filter((x) => x === 'ek-9308')).toHaveLength(1);
    const sets = await workoutsRepo.listSets(db, w.id);
    expect(sets.map((s) => [s.exerciseId, s.weightKg])).toEqual([['ek-9307', 20]]);
  });

  it('la máquina de discos se marca para mostrar kg por lado', () => {
    expect(getLibraryExercise('ek-9307')?.plateLoading).toBe('both-sides');
    expect(getLibraryExercise('ek-9308')?.primary).toEqual(['shoulders']);
  });
});

describe('ajuste del 20-11-2026: el jueves vuelve a Hombro y antebrazo', () => {
  it('reasigna el jueves si quedó de descanso', async () => {
    await ensureDefaultPlan(db, profileId);
    await templatesRepo.setDay(db, profileId, 4, null);
    await applyPlanUpdates(db, profileId);
    const list = await templatesRepo.list(db, profileId);
    const thu = (await templatesRepo.schedule(db, profileId))[3]!;
    expect(list.find((t) => t.id === thu.templateId)?.name).toBe('Hombro y antebrazo');
  });

  it('restaura la rutina si se había borrado (sin duplicarla)', async () => {
    await ensureDefaultPlan(db, profileId);
    const sh = (await templatesRepo.list(db, profileId)).find((t) => t.name === 'Hombro y antebrazo')!;
    await templatesRepo.remove(db, sh.id);
    await applyPlanUpdates(db, profileId);
    const list = await templatesRepo.list(db, profileId);
    expect(list.filter((t) => t.name === 'Hombro y antebrazo').map((t) => t.id)).toEqual([sh.id]);
    expect((await templatesRepo.schedule(db, profileId))[3]!.templateId).toBe(sh.id);
    expect((await templatesRepo.exercises(db, sh.id)).length).toBeGreaterThan(0);
  });

  it('se aplica una sola vez: si luego lo cambias a descanso, se respeta', async () => {
    await ensureDefaultPlan(db, profileId);
    await applyPlanUpdates(db, profileId);
    await templatesRepo.setDay(db, profileId, 4, null);
    await applyPlanUpdates(db, profileId);
    expect((await templatesRepo.schedule(db, profileId))[3]!.templateId).toBeNull();
  });
});
