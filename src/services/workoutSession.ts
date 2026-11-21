import type { Db } from '@/database/types';
import { transaction } from '@/database/transaction';
import { workoutsRepo, type Workout } from '@/database/repositories/workouts';
import { isoWeekStart, localDateKey } from '@/lib/time';
import { awardXp, totalXp, type AwardResult } from './xp';
import { maxLevelReached } from './penance';
import { levelFromXp } from '@/features/progression/leveling';
import { bodyMetricsRepo } from '@/database/repositories/bodyMetrics';
import { usableBodyweight } from '@/features/training/load';
import { primaryMuscles } from '@/features/training/muscles';
import { estimateWorkoutEnergy, volumeLoadKg, type EnergyEstimate } from '@/features/training/energy';

/** Mínimo para que una sesión cuente como entrenamiento (y dé XP). */
export const MIN_COMPLETED_SETS = 3;

export interface FinishResult {
  workout: Workout;
  completedSets: number;
  xp: AwardResult;
  /** XP extra por memoria muscular (penitencia previa): 0 si no aplica. */
  comebackXp: number;
  /** null si no hay peso corporal confirmado de los últimos 30 días. */
  energy: EnergyEstimate | null;
  volumeKg: number;
}

export class WorkoutValidationError extends Error {}

/**
 * Cierra la sesión. Exige al menos MIN_COMPLETED_SETS series marcadas como hechas,
 * para que la XP refleje un entrenamiento real y no un toque accidental.
 */
export async function finishWorkout(db: Db, workoutId: string, now: Date = new Date()): Promise<FinishResult> {
  return transaction(db, async () => {
    const w = await workoutsRepo.getById(db, workoutId);
    if (!w) throw new WorkoutValidationError('La sesión no existe.');
    if (w.status !== 'in_progress') throw new WorkoutValidationError('La sesión ya estaba cerrada.');

    const sets = await workoutsRepo.listSets(db, workoutId);
    const completedSets = sets.filter((s) => s.completed).length;
    if (completedSets < MIN_COMPLETED_SETS) {
      throw new WorkoutValidationError(
        `Marca al menos ${MIN_COMPLETED_SETS} series como hechas para terminar (llevas ${completedSets}).`,
      );
    }

    await workoutsRepo.setStatus(db, workoutId, 'completed', now.toISOString());
    const energy = await computeEnergy(db, w.profileId, w.startedAt, now.toISOString(), sets, now);
    await workoutsRepo.setEnergy(db, workoutId, energy);
    const xp = await awardXp(db, {
      profileId: w.profileId,
      source: 'workout',
      sourceId: workoutId,
      idempotencyKey: `workout:${workoutId}`,
      at: now,
    });
    // Memoria muscular: XP doble en sesiones mientras estés por debajo de tu nivel máximo
    let comebackXp = 0;
    const maxLevel = await maxLevelReached(db, w.profileId);
    if (xp.awarded > 0 && levelFromXp(await totalXp(db, w.profileId)).level < maxLevel) {
      comebackXp = (
        await awardXp(db, { profileId: w.profileId, source: 'comeback', sourceId: workoutId, idempotencyKey: `comeback:${workoutId}`, at: now })
      ).awarded;
    }
    return { workout: (await workoutsRepo.getById(db, workoutId))!, completedSets, xp, comebackXp, energy, volumeKg: volumeLoadKg(sets) };
  });
}

async function computeEnergy(
  db: Db,
  profileId: string,
  startedAt: string,
  finishedAt: string,
  sets: Array<{ exerciseId: string; completed: boolean }>,
  now: Date,
): Promise<EnergyEstimate | null> {
  const bw = usableBodyweight(await bodyMetricsRepo.latest(db, profileId), now);
  if (bw == null) return null;
  return estimateWorkoutEnergy({
    startedAt,
    finishedAt,
    bodyweightKg: bw,
    sets: sets.map((s) => ({ exerciseId: s.exerciseId, completed: s.completed, primary: primaryMuscles(s.exerciseId) })),
  });
}

/**
 * Calcula las kcal de sesiones terminadas que aún no las tienen (anteriores a la función o sin peso en su día).
 * Usa el peso confirmado más cercano a la fecha de cada sesión (±30 días); si no hay, la deja pendiente.
 * Devuelve cuántas se calcularon.
 */
export async function backfillWorkoutEnergy(db: Db, profileId: string): Promise<number> {
  const pending = await db.getAllAsync<{ id: string; started_at: string; finished_at: string }>(
    `SELECT id, started_at, finished_at FROM workouts
     WHERE profile_id = ? AND status = 'completed' AND deleted_at IS NULL AND finished_at IS NOT NULL AND energy_kcal IS NULL
     ORDER BY started_at DESC LIMIT 200`,
    [profileId],
  );
  let done = 0;
  for (const w of pending) {
    const bw = await bodyMetricsRepo.confirmedWeightNear(db, profileId, w.started_at);
    if (bw == null) continue;
    const sets = await workoutsRepo.listSets(db, w.id);
    const energy = estimateWorkoutEnergy({
      startedAt: w.started_at,
      finishedAt: w.finished_at,
      bodyweightKg: bw,
      sets: sets.map((s) => ({ exerciseId: s.exerciseId, completed: s.completed, primary: primaryMuscles(s.exerciseId) })),
    });
    if (!energy) continue;
    await workoutsRepo.setEnergy(db, w.id, energy);
    done++;
  }
  return done;
}

/** Vuelve a estimar las kcal de una sesión terminada (p. ej. tras registrar el peso de hoy). */
export async function recomputeWorkoutEnergy(db: Db, workoutId: string, now: Date = new Date()): Promise<EnergyEstimate | null> {
  const w = await workoutsRepo.getById(db, workoutId);
  if (!w || w.status !== 'completed' || !w.finishedAt) return null;
  const sets = await workoutsRepo.listSets(db, workoutId);
  const energy = await computeEnergy(db, w.profileId, w.startedAt, w.finishedAt, sets, now);
  await workoutsRepo.setEnergy(db, workoutId, energy);
  return energy;
}

/** Descarta una sesión sin otorgar XP (las series quedan guardadas como historial abandonado). */
export async function abandonWorkout(db: Db, workoutId: string): Promise<void> {
  await workoutsRepo.setStatus(db, workoutId, 'abandoned', new Date().toISOString());
}

/** Lunes (fecha local) de la semana ISO que contiene `date`. */
export function weekStartKey(date: Date = new Date()): string {
  return isoWeekStart(date);
}

/** Entrenamientos completados en la semana actual (lunes a domingo, hora local). */
export async function workoutsThisWeek(db: Db, profileId: string, now: Date = new Date()): Promise<number> {
  const since = new Date(now.getTime() - 8 * 86_400_000).toISOString();
  const start = weekStartKey(now);
  const recent = await workoutsRepo.listCompletedSince(db, profileId, since);
  return recent.filter((w) => localDateKey(new Date(w.startedAt)) >= start).length;
}
