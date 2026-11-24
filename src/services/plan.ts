import { z } from 'zod';
import type { Db } from '@/database/types';
import { transaction } from '@/database/transaction';
import { settingsRepo } from '@/database/repositories/settings';
import { templatesRepo, type Template, type TemplateExercise } from '@/database/repositories/templates';
import { ensureExercise, workoutsRepo, type Workout, type WorkoutSet } from '@/database/repositories/workouts';
import { getLibraryExercise } from '@/features/exercises/library';
import { loadStep, suggestProgression, type Suggestion } from '@/features/training/progression';
import { setLoadMode } from '@/features/training/load';
import { DEFAULT_SCHEDULE, DEFAULT_TEMPLATES, firstNumber } from '@/features/training/defaultPlan';
import { findOption } from '@/features/training/exerciseOptions';
import type { MuscleGroup } from '@/features/exercises/library';
import { primaryMuscles } from '@/features/training/muscles';
import { localDateKey } from '@/lib/time';
import { weekStartKey } from './workoutSession';

const SEEDED_KEY = 'plan.seeded.v1';

/**
 * Crea una sola vez el plan semanal aprobado (rutinas + días) y guarda el año de nacimiento.
 * Si el usuario luego borra o cambia rutinas, no se vuelve a sembrar.
 */
const pending = new Map<string, Promise<boolean>>();

export function ensureDefaultPlan(db: Db, profileId: string): Promise<boolean> {
  // Varias pantallas refrescan a la vez al abrir la app: una sola siembra en vuelo por perfil.
  const running = pending.get(profileId);
  if (running) return running;
  const p = seed(db, profileId).finally(() => pending.delete(profileId));
  pending.set(profileId, p);
  return p;
}

async function seed(db: Db, profileId: string): Promise<boolean> {
  const seeded = await settingsRepo.get(db, profileId, SEEDED_KEY, z.boolean());
  if (seeded) return false;
  await transaction(db, async (db) => {
    const ids = new Map<string, string>();
    for (const t of DEFAULT_TEMPLATES) {
      const id = await templatesRepo.create(db, profileId, { name: t.name, description: t.description, kind: t.kind });
      ids.set(t.key, id);
      for (const e of t.exercises) {
        const opt = findOption(e.exerciseId);
        if (!opt) throw new Error(`Ejercicio del plan no encontrado: ${e.exerciseId}`);
        await ensureExercise(db, opt.ref);
        await templatesRepo.addExercise(db, id, e.exerciseId, { sets: e.sets, target: e.target, notes: e.notes ?? null });
      }
    }
    for (const [day, key] of Object.entries(DEFAULT_SCHEDULE)) {
      await templatesRepo.setDay(db, profileId, Number(day), ids.get(key) ?? null);
    }
    await settingsRepo.set(db, profileId, SEEDED_KEY, z.boolean(), true);
  });
  return true;
}

/** Día ISO de la fecha local: 1 = lunes … 7 = domingo. */
export function isoWeekday(date: Date = new Date()): number {
  const [y, m, d] = localDateKey(date).split('-').map(Number) as [number, number, number];
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow === 0 ? 7 : dow;
}

export interface TodayPlan {
  weekday: number;
  template: Template | null;
}

export async function todayPlan(db: Db, profileId: string, now: Date = new Date()): Promise<TodayPlan> {
  const weekday = isoWeekday(now);
  const day = (await templatesRepo.schedule(db, profileId)).find((d) => d.weekday === weekday);
  const template = day?.templateId ? await templatesRepo.get(db, day.templateId) : null;
  return { weekday, template };
}

/**
 * Empieza una sesión con las series de la rutina ya creadas:
 * repeticiones (o segundos) = primer número del objetivo; peso = el de la última vez que hiciste ese ejercicio.
 * Si ya hay una sesión en curso, la devuelve sin tocarla.
 */
export async function startFromTemplate(db: Db, profileId: string, templateId: string): Promise<Workout> {
  return transaction(db, async (db) => {
    const current = await workoutsRepo.getInProgress(db, profileId);
    if (current) return current;
    const w = await workoutsRepo.start(db, profileId, templateId);
    const exercises = await templatesRepo.exercises(db, templateId);
    for (const e of exercises) {
      const last = await workoutsRepo.lastCompletedSets(db, profileId, e.exerciseId, w.id);
      const goal = firstNumber(e.target);
      const sug = suggestionFor(e.exerciseId, e.target, last);
      for (let i = 0; i < e.sets; i++) {
        const prev = last[Math.min(i, last.length - 1)];
        // Doble progresión: si toca subir, todas las series arrancan con la carga nueva
        const up = sug?.kind === 'increase';
        await workoutsRepo.addSet(db, w.id, e.exerciseId, {
          repetitions: e.exerciseType === 'time' ? null : up ? sug.reps : goal,
          durationSeconds: e.exerciseType === 'time' ? goal : null,
          weightKg: up && sug.field === 'weight' ? sug.toKg : (prev?.weightKg ?? null),
          assistanceKg: up && sug.field === 'assistance' ? sug.toKg : (prev?.assistanceKg ?? null),
          completed: false,
        });
      }
    }
    return w;
  });
}

/** Sugerencia de progresión de un ejercicio según su objetivo y las series de la última vez. */
export function suggestionFor(exerciseId: string, target: string, last: WorkoutSet[]): Suggestion | null {
  const opt = findOption(exerciseId);
  const lib = getLibraryExercise(opt?.libraryId ?? exerciseId);
  if (!opt || lib?.measure === 'time') return null;
  return suggestProgression({
    target,
    // Dominadas/fondos hechos con asistencia la última vez: la progresión es bajar la asistencia.
    loadMode: last.some((l) => setLoadMode(opt.ref.loadMode, l) === 'assisted') ? 'assisted' : opt.ref.loadMode,
    lastSets: last,
    step: loadStep(lib?.equipment ?? [], lib?.plateLoading === 'both-sides'),
  });
}

/** Sugerencias para los ejercicios de una sesión con rutina (exerciseId → sugerencia y última vez). */
export async function sessionSuggestions(
  db: Db,
  workout: Workout,
): Promise<Map<string, { suggestion: Suggestion; last: WorkoutSet[] }>> {
  const out = new Map<string, { suggestion: Suggestion; last: WorkoutSet[] }>();
  for (const [exerciseId, t] of await sessionTargets(db, workout)) {
    const last = await workoutsRepo.lastCompletedSets(db, workout.profileId, exerciseId, workout.id);
    const suggestion = suggestionFor(exerciseId, t.target, last);
    if (suggestion) out.set(exerciseId, { suggestion, last });
  }
  return out;
}

/** Objetivos de la rutina de la sesión (exerciseId → ejercicio de la rutina). */
export async function sessionTargets(db: Db, workout: Workout): Promise<Map<string, TemplateExercise>> {
  if (!workout.templateId) return new Map();
  const list = await templatesRepo.exercises(db, workout.templateId);
  const byId = new Map(list.map((e) => [e.exerciseId, e]));
  // Ejercicios cambiados en la sesión: heredan el objetivo del previsto (reps → segundos no aplica aquí).
  const swaps = await db.getAllAsync<{ exercise_id: string; planned_exercise_id: string }>(
    `SELECT DISTINCT exercise_id, planned_exercise_id FROM workout_sets
     WHERE workout_id = ? AND planned_exercise_id IS NOT NULL`,
    [workout.id],
  );
  for (const sw of swaps) {
    const planned = byId.get(sw.planned_exercise_id);
    if (planned && !byId.has(sw.exercise_id)) byId.set(sw.exercise_id, planned);
  }
  return byId;
}

/** Cambia un ejercicio de la sesión por otro de la biblioteca (lo registra si hace falta). */
export async function swapSessionExercise(db: Db, workoutId: string, fromExerciseId: string, toExerciseId: string): Promise<void> {
  const opt = findOption(toExerciseId);
  if (!opt) throw new Error('Ejercicio no encontrado');
  await ensureExercise(db, opt.ref);
  await workoutsRepo.swapExercise(db, workoutId, fromExerciseId, opt.ref.id);
}

const UPDATE_2026_11_19 = 'plan.update.2026-11-19';

/**
 * Ajustes puntuales aprobados por el usuario sobre un plan ya creado (se aplican una sola vez):
 * - 19-11-2026: elevación frontal con disco 4×12 en «Hombro y antebrazo», tras las elevaciones laterales.
 * - 19-11-2026: ese día hizo el press de hombro en máquina, pero lo anotó como press militar con barra;
 *   sus series de ese día pasan al ejercicio de máquina.
 */
export function applyPlanUpdates(db: Db, profileId: string): Promise<void> {
  const key = `updates:${profileId}`;
  const running = pendingUpdates.get(key);
  if (running) return running;
  const p = runPlanUpdates(db, profileId).finally(() => pendingUpdates.delete(key));
  pendingUpdates.set(key, p);
  return p;
}
const pendingUpdates = new Map<string, Promise<void>>();

async function runPlanUpdates(db: Db, profileId: string): Promise<void> {
  await update20261119(db, profileId);
  await update20261120(db, profileId);
}

const UPDATE_2026_11_20 = 'plan.update.2026-11-20';

/**
 * 20-11-2026: el jueves apareció como descanso, pero el plan del usuario es fijo:
 * solo el miércoles es opcional. Se vuelve a asignar «Hombro y antebrazo» al jueves
 * (restaurándola si se había borrado, o recreándola desde el plan si ya no existe).
 */
async function update20261120(db: Db, profileId: string): Promise<void> {
  const done = await settingsRepo.get(db, profileId, UPDATE_2026_11_20, z.boolean());
  if (done) return;
  await transaction(db, async (db) => {
    const thursday = (await templatesRepo.schedule(db, profileId)).find((d) => d.weekday === 4);
    if (!thursday?.templateId) {
      const name = 'Hombro y antebrazo';
      const existing = await db.getFirstAsync<{ id: string; deleted_at: string | null }>(
        `SELECT id, deleted_at FROM workout_templates WHERE profile_id = ? AND name = ?
         ORDER BY deleted_at IS NOT NULL, updated_at DESC LIMIT 1`,
        [profileId, name],
      );
      let id = existing?.id ?? null;
      if (existing?.deleted_at) await templatesRepo.restore(db, existing.id);
      if (!id) {
        const t = DEFAULT_TEMPLATES.find((x) => x.key === 'shoulders')!;
        id = await templatesRepo.create(db, profileId, { name: t.name, description: t.description, kind: t.kind });
        for (const e of t.exercises) {
          await ensureExercise(db, findOption(e.exerciseId)!.ref);
          await templatesRepo.addExercise(db, id, e.exerciseId, { sets: e.sets, target: e.target, notes: e.notes ?? null });
        }
      }
      await templatesRepo.setDay(db, profileId, 4, id);
    }
    await settingsRepo.set(db, profileId, UPDATE_2026_11_20, z.boolean(), true);
  });
}

async function update20261119(db: Db, profileId: string): Promise<void> {
  const done = await settingsRepo.get(db, profileId, UPDATE_2026_11_19, z.boolean());
  if (done) return;
  await transaction(db, async (db) => {
    const shoulders = (await templatesRepo.list(db, profileId)).find((t) => t.name === 'Hombro y antebrazo');
    if (shoulders) {
      const list = await templatesRepo.exercises(db, shoulders.id);
      if (!list.some((e) => e.exerciseId === 'ek-9308')) {
        const opt = findOption('ek-9308')!;
        await ensureExercise(db, opt.ref);
        const rowId = await templatesRepo.addExercise(db, shoulders.id, 'ek-9308', { sets: 4, target: '12' });
        const lateralIdx = list.findIndex((e) => e.exerciseId === 'ek-0018');
        if (lateralIdx >= 0) {
          for (let i = list.length; i > lateralIdx + 1; i--) await templatesRepo.move(db, rowId, -1);
        }
      }
    }
    const day = await db.getAllAsync<{ id: string; started_at: string }>(
      `SELECT DISTINCT w.id, w.started_at FROM workouts w JOIN workout_sets s ON s.workout_id = w.id
       WHERE w.profile_id = ? AND w.deleted_at IS NULL AND s.exercise_id = 'ek-0004'`,
      [profileId],
    );
    for (const w of day) {
      if (localDateKey(new Date(w.started_at)) !== '2026-11-19') continue;
      const has = await db.getFirstAsync<{ n: number }>(
        `SELECT COUNT(*) AS n FROM workout_sets WHERE workout_id = ? AND exercise_id = 'ek-9307'`,
        [w.id],
      );
      if ((has?.n ?? 0) === 0) await swapSessionExercise(db, w.id, 'ek-0004', 'ek-9307');
    }
    await settingsRepo.set(db, profileId, UPDATE_2026_11_19, z.boolean(), true);
  });
}

export { primaryMuscles };

/**
 * Series hechas esta semana (lunes–domingo) por músculo principal, en sesiones terminadas.
 * Referencia: ≥10 series semanales por músculo se asocian a más hipertrofia (Schoenfeld 2017).
 */
export async function weeklySetsByMuscle(db: Db, profileId: string, now: Date = new Date()): Promise<Partial<Record<MuscleGroup, number>>> {
  const since = new Date(now.getTime() - 8 * 86_400_000).toISOString();
  const start = weekStartKey(now);
  const rows = await workoutsRepo.completedSetsSince(db, profileId, since);
  const out: Partial<Record<MuscleGroup, number>> = {};
  for (const r of rows) {
    if (localDateKey(new Date(r.startedAt)) < start) continue;
    for (const m of primaryMuscles(r.exerciseId)) out[m] = (out[m] ?? 0) + 1;
  }
  return out;
}

export const WEEKLY_SETS_TARGET = 10;
