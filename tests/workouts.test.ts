/**
 * @jest-environment node
 */
import { createTestDb } from './helpers/nodeDb';
import { migrate, profilesRepo } from '@/database';
import { ensureExercise, workoutsRepo } from '@/database/repositories/workouts';
import { awardXp, totalXp } from '@/services/xp';
import { finishWorkout, weekStartKey, workoutsThisWeek, WorkoutValidationError } from '@/services/workoutSession';
import { effectiveLoadKg, setLoadMode, usableBodyweight, validateAssistance } from '@/features/training/load';
import { MIGRATIONS } from '@/database/migrations';
import { suggestionFor } from '@/services/plan';

let db: ReturnType<typeof createTestDb>;
let profileId: string;
const curl = { id: 'tech-barbell-curl', name: 'Curl con barra', category: 'gym', primaryMuscle: 'biceps', equipment: 'barbell', isBodyweight: false, loadMode: 'external' as const };

beforeEach(async () => {
  db = createTestDb();
  await migrate(db);
  profileId = (await profilesRepo.create(db, { displayName: 'Test', heightCm: 175 })).id;
  await ensureExercise(db, curl);
});
afterEach(() => db.close());

describe('sesión de entrenamiento', () => {
  it('start es idempotente: nunca hay dos sesiones en curso', async () => {
    const a = await workoutsRepo.start(db, profileId);
    const b = await workoutsRepo.start(db, profileId);
    expect(b.id).toBe(a.id);
  });

  it('las series se guardan al instante y copian los valores de la anterior', async () => {
    const w = await workoutsRepo.start(db, profileId);
    const s1 = await workoutsRepo.addSet(db, w.id, curl.id, { repetitions: 10, weightKg: 20 });
    const s2 = await workoutsRepo.addSet(db, w.id, curl.id);
    expect(s2.setNumber).toBe(2);
    expect([s2.repetitions, s2.weightKg]).toEqual([10, 20]);
    await workoutsRepo.updateSet(db, s1.id, { repetitions: 12, weightKg: 20, completed: true });
    const sets = await workoutsRepo.listSets(db, w.id);
    expect(sets.map((s) => [s.setNumber, s.repetitions, s.completed])).toEqual([[1, 12, true], [2, 10, false]]);
    expect(sets[0]!.exerciseName).toBe('Curl con barra');
  });

  it('rechaza valores imposibles', async () => {
    const w = await workoutsRepo.start(db, profileId);
    await expect(workoutsRepo.addSet(db, w.id, curl.id, { repetitions: -1 })).rejects.toThrow();
    const s = await workoutsRepo.addSet(db, w.id, curl.id);
    await expect(workoutsRepo.updateSet(db, s.id, { repetitions: 10, weightKg: 9999, completed: true })).rejects.toThrow();
  });

  it('terminar exige 3 series hechas', async () => {
    const w = await workoutsRepo.start(db, profileId);
    const s = await workoutsRepo.addSet(db, w.id, curl.id, { repetitions: 10, weightKg: 20, completed: true });
    await expect(finishWorkout(db, w.id)).rejects.toThrow(WorkoutValidationError);
    expect((await workoutsRepo.getById(db, w.id))?.status).toBe('in_progress');
    expect(s.completed).toBe(true);
  });

  it('terminar otorga 100 XP una sola vez', async () => {
    const w = await workoutsRepo.start(db, profileId);
    for (let i = 0; i < 3; i++) await workoutsRepo.addSet(db, w.id, curl.id, { repetitions: 10, weightKg: 20, completed: true });
    const r = await finishWorkout(db, w.id);
    expect(r.xp).toEqual({ awarded: 100, reason: 'ok' });
    expect(r.workout.status).toBe('completed');
    await expect(finishWorkout(db, w.id)).rejects.toThrow(/cerrada/);
    expect(await totalXp(db, profileId)).toBe(100);
  });

  it('segundo entrenamiento el mismo día: se guarda pero no suma XP (tope diario)', async () => {
    for (let k = 0; k < 2; k++) {
      const w = await workoutsRepo.start(db, profileId);
      for (let i = 0; i < 3; i++) await workoutsRepo.addSet(db, w.id, curl.id, { repetitions: 8, weightKg: 20, completed: true });
      const r = await finishWorkout(db, w.id);
      expect(r.xp.awarded).toBe(k === 0 ? 100 : 0);
    }
    expect(await totalXp(db, profileId)).toBe(100);
    expect(await workoutsThisWeek(db, profileId)).toBe(2);
  });

  it('quitar un ejercicio añadido por error borra solo sus series', async () => {
    const row = { ...curl, id: 'tech-dumbbell-row', name: 'Remo con mancuerna' };
    await ensureExercise(db, row);
    const w = await workoutsRepo.start(db, profileId);
    await workoutsRepo.addSet(db, w.id, curl.id, { repetitions: 10, weightKg: 20, completed: true });
    await workoutsRepo.addSet(db, w.id, row.id);
    await workoutsRepo.addSet(db, w.id, row.id);
    expect(await workoutsRepo.removeExercise(db, w.id, row.id)).toBe(2);
    const sets = await workoutsRepo.listSets(db, w.id);
    expect(sets.map((s) => s.exerciseId)).toEqual([curl.id]);
  });

  it('no se pueden quitar ejercicios de una sesión ya terminada', async () => {
    const w = await workoutsRepo.start(db, profileId);
    for (let i = 0; i < 3; i++) await workoutsRepo.addSet(db, w.id, curl.id, { repetitions: 10, weightKg: 20, completed: true });
    await finishWorkout(db, w.id);
    expect(await workoutsRepo.removeExercise(db, w.id, curl.id)).toBe(0);
    expect(await workoutsRepo.listSets(db, w.id)).toHaveLength(3);
  });

  it('awardXp con la misma clave no duplica', async () => {
    const args = { profileId, source: 'workout' as const, sourceId: 'x', idempotencyKey: 'workout:x' };
    expect((await awardXp(db, args)).reason).toBe('ok');
    expect((await awardXp(db, args)).reason).toBe('duplicate');
    expect(await totalXp(db, profileId)).toBe(100);
  });
});

describe('carga efectiva y dominadas asistidas', () => {
  const assisted = { ...curl, id: 'ek-9087', name: 'Dominadas asistidas', loadMode: 'assisted' as const, isBodyweight: true };

  it('fórmulas: externo, peso corporal + lastre, peso corporal − asistencia', () => {
    expect(effectiveLoadKg('external', { weightKg: 20, assistanceKg: null, bodyweightKg: 84 })).toBe(20);
    expect(effectiveLoadKg('bodyweight', { weightKg: 10, assistanceKg: null, bodyweightKg: 84 })).toBe(94);
    expect(effectiveLoadKg('bodyweight', { weightKg: null, assistanceKg: null, bodyweightKg: 84 })).toBe(84);
    expect(effectiveLoadKg('assisted', { weightKg: null, assistanceKg: 25, bodyweightKg: 84 })).toBe(59);
    expect(effectiveLoadKg('assisted', { weightKg: null, assistanceKg: 25, bodyweightKg: null })).toBeNull();
    expect(validateAssistance(90, 84)).toMatch(/asistencia/);
    expect(validateAssistance(20, 84)).toBeNull();
  });

  it('peso corporal admite asistencia por serie (resta, no suma)', () => {
    expect(effectiveLoadKg('bodyweight', { weightKg: null, assistanceKg: 43.75, bodyweightKg: 86.6 })).toBeCloseTo(42.85);
    expect(setLoadMode('bodyweight', { assistanceKg: 43.75 })).toBe('assisted');
    expect(setLoadMode('bodyweight', { assistanceKg: null })).toBe('bodyweight');
    expect(setLoadMode('bodyweight', { assistanceKg: 0 })).toBe('bodyweight');
    expect(setLoadMode('external', { assistanceKg: 5 })).toBe('external');
  });

  it('dominadas con asistencia la última vez: la progresión baja la asistencia', () => {
    const last = [1, 2, 3, 4].map((n) => ({ setNumber: n, repetitions: 10, weightKg: null, assistanceKg: 43.75, completed: true })) as never;
    const sug = suggestionFor('ek-0087', '10', last);
    expect(sug).toMatchObject({ kind: 'increase', field: 'assistance', fromKg: 43.75 });
    expect((sug as { toKg: number }).toKg).toBeLessThan(43.75);
  });

  it('migración 8: pasa a asistencia los kg de dominadas/fondos del 23 y 24-11-2026', async () => {
    const fresh = createTestDb();
    await migrate(fresh, MIGRATIONS.slice(0, 7));
    const pid = (await profilesRepo.create(fresh, { displayName: 'T', heightCm: 175 })).id;
    const dips = { ...curl, id: 'ek-0054', name: 'Fondos', loadMode: 'bodyweight' as const, isBodyweight: true };
    await ensureExercise(fresh, dips);
    await ensureExercise(fresh, curl);
    const mk = async (startedAt: string) => {
      const w = await workoutsRepo.start(fresh, pid);
      await fresh.runAsync('UPDATE workouts SET started_at = ? WHERE id = ?', [startedAt, w.id]);
      const d = await workoutsRepo.addSet(fresh, w.id, dips.id, { repetitions: 10, weightKg: 30, bodyweightKg: 86.6 });
      const c = await workoutsRepo.addSet(fresh, w.id, curl.id, { repetitions: 10, weightKg: 20 });
      await fresh.runAsync("UPDATE workouts SET status = 'completed' WHERE id = ?", [w.id]);
      return { d: d.id, c: c.id };
    };
    const monday = await mk('2026-11-23T22:10:00.000Z'); // lunes 19:10 Chile
    const before = await mk('2026-11-20T22:10:00.000Z'); // viernes: no se toca
    await migrate(fresh);
    const row = (id: string) =>
      fresh.getFirstAsync<{ weight_kg: number | null; assistance_kg: number | null }>('SELECT weight_kg, assistance_kg FROM workout_sets WHERE id = ?', [id]);
    expect(await row(monday.d)).toEqual({ weight_kg: null, assistance_kg: 30 });
    expect(await row(monday.c)).toEqual({ weight_kg: 20, assistance_kg: null });
    expect(await row(before.d)).toEqual({ weight_kg: 30, assistance_kg: null });
    fresh.close();
  });

  it('solo usa un peso confirmado de los últimos 30 días', () => {
    const now = new Date('2026-11-18T12:00:00Z');
    expect(usableBodyweight({ weightKg: 84, measuredAt: '2026-11-10T12:00:00Z', dataStatus: 'confirmed' }, now)).toBe(84);
    expect(usableBodyweight({ weightKg: 90, measuredAt: '2026-05-01T12:00:00Z', dataStatus: 'historical' }, now)).toBeNull();
    expect(usableBodyweight({ weightKg: 84, measuredAt: '2026-09-01T12:00:00Z', dataStatus: 'confirmed' }, now)).toBeNull();
    expect(usableBodyweight(null, now)).toBeNull();
  });

  it('guarda asistencia y foto del peso; la siguiente serie las copia', async () => {
    await ensureExercise(db, assisted);
    const w = await workoutsRepo.start(db, profileId);
    const s1 = await workoutsRepo.addSet(db, w.id, assisted.id);
    expect(s1.loadMode).toBe('assisted');
    await workoutsRepo.updateSet(db, s1.id, { repetitions: 8, weightKg: null, assistanceKg: 25, bodyweightKg: 84, completed: true });
    const s2 = await workoutsRepo.addSet(db, w.id, assisted.id);
    expect([s2.assistanceKg, s2.bodyweightKg]).toEqual([25, 84]);
  });

  it('rechaza asistencia igual o mayor que el peso corporal', async () => {
    await ensureExercise(db, assisted);
    const w = await workoutsRepo.start(db, profileId);
    const s = await workoutsRepo.addSet(db, w.id, assisted.id);
    await expect(
      workoutsRepo.updateSet(db, s.id, { repetitions: 8, weightKg: null, assistanceKg: 84, bodyweightKg: 84, completed: true }),
    ).rejects.toThrow();
  });
});

describe('deshacer borrado de serie', () => {
  it('restaura la serie con sus valores y no la duplica', async () => {
    const w = await workoutsRepo.start(db, profileId);
    const s = await workoutsRepo.addSet(db, w.id, curl.id, { repetitions: 10, weightKg: 22.5, completed: true });
    await workoutsRepo.deleteSet(db, s.id);
    expect(await workoutsRepo.listSets(db, w.id)).toHaveLength(0);
    await workoutsRepo.restoreSet(db, s);
    await workoutsRepo.restoreSet(db, s);
    const sets = await workoutsRepo.listSets(db, w.id);
    expect(sets).toHaveLength(1);
    expect([sets[0]!.id, sets[0]!.repetitions, sets[0]!.weightKg, sets[0]!.completed]).toEqual([s.id, 10, 22.5, true]);
  });

  it('no restaura en una sesión ya terminada', async () => {
    const w = await workoutsRepo.start(db, profileId);
    const sets = [];
    for (let i = 0; i < 4; i++) sets.push(await workoutsRepo.addSet(db, w.id, curl.id, { repetitions: 10, weightKg: 20, completed: true }));
    await workoutsRepo.deleteSet(db, sets[3]!.id);
    await finishWorkout(db, w.id);
    await workoutsRepo.restoreSet(db, sets[3]!);
    expect(await workoutsRepo.listSets(db, w.id)).toHaveLength(3);
  });
});

describe('semana', () => {
  it('weekStartKey devuelve el lunes local', () => {
    // Martes 17-11-2026 20:00 en Santiago (23:00 UTC)
    expect(weekStartKey(new Date('2026-11-17T23:00:00Z'))).toBe('2026-11-16');
    // Domingo 22-11 23:30 Santiago = lunes 23 02:30 UTC → sigue siendo la semana del 16
    expect(weekStartKey(new Date('2026-11-23T02:30:00Z'))).toBe('2026-11-16');
  });
});
