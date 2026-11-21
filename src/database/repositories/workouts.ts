import { z } from 'zod';
import type { Db } from '../types';
import { newId } from '../ids';
import { transaction } from '../transaction';
import { nowIso } from '@/lib/time';
import type { LoadMode } from '@/features/training/load';

// ─── Ejercicios (tabla `exercises`) ───────────────────────

export interface ExerciseRef {
  id: string;
  name: string;
  category: string;
  primaryMuscle: string;
  equipment: string;
  isBodyweight: boolean;
  loadMode: LoadMode;
  /** 'time' para isométricos (planchas): la serie se registra en segundos. */
  exerciseType?: 'reps' | 'time';
}

/** Registra el ejercicio del catálogo en SQLite la primera vez que se usa (idempotente). */
export async function ensureExercise(db: Db, e: ExerciseRef): Promise<void> {
  const now = nowIso();
  await db.runAsync(
    `INSERT INTO exercises (id, profile_id, name, category, primary_muscle, equipment, exercise_type, is_bodyweight, load_mode, created_at, updated_at)
     VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET name = excluded.name, load_mode = excluded.load_mode,
       exercise_type = excluded.exercise_type, updated_at = excluded.updated_at`,
    [e.id, e.name, e.category, e.primaryMuscle, e.equipment, e.exerciseType ?? 'reps', e.isBodyweight ? 1 : 0, e.loadMode, now, now],
  );
}

// ─── Sesiones y series ────────────────────────────────────

export interface Workout {
  id: string;
  profileId: string;
  startedAt: string;
  finishedAt: string | null;
  status: 'in_progress' | 'completed' | 'abandoned';
  notes: string | null;
  templateId: string | null;
  energyKcal: number | null;
  energyMet: number | null;
  energyMinutes: number | null;
}

export interface WorkoutSet {
  id: string;
  workoutId: string;
  exerciseId: string;
  exerciseName: string;
  setNumber: number;
  repetitions: number | null;
  weightKg: number | null;
  assistanceKg: number | null;
  bodyweightKg: number | null;
  loadMode: LoadMode;
  exerciseType: 'reps' | 'time';
  durationSeconds: number | null;
  /** Ejercicio previsto por la rutina si esta serie se cambió a otro. */
  plannedExerciseId: string | null;
  rpe: number | null;
  completed: boolean;
}

interface WorkoutRow {
  id: string;
  profile_id: string;
  started_at: string;
  finished_at: string | null;
  status: Workout['status'];
  notes: string | null;
  template_id: string | null;
  energy_kcal: number | null;
  energy_met: number | null;
  energy_minutes: number | null;
}
interface SetRow {
  id: string;
  workout_id: string;
  exercise_id: string;
  exercise_name: string;
  set_number: number;
  repetitions: number | null;
  weight_kg: number | null;
  assistance_kg: number | null;
  bodyweight_kg: number | null;
  load_mode: LoadMode | null;
  exercise_type: 'reps' | 'time' | 'distance' | null;
  duration_seconds: number | null;
  planned_exercise_id: string | null;
  rpe: number | null;
  completed: number;
}

const mapW = (r: WorkoutRow): Workout => ({
  id: r.id,
  profileId: r.profile_id,
  startedAt: r.started_at,
  finishedAt: r.finished_at,
  status: r.status,
  notes: r.notes,
  templateId: r.template_id ?? null,
  energyKcal: r.energy_kcal ?? null,
  energyMet: r.energy_met ?? null,
  energyMinutes: r.energy_minutes ?? null,
});
const mapS = (r: SetRow): WorkoutSet => ({
  id: r.id,
  workoutId: r.workout_id,
  exerciseId: r.exercise_id,
  exerciseName: r.exercise_name,
  setNumber: r.set_number,
  repetitions: r.repetitions,
  weightKg: r.weight_kg,
  assistanceKg: r.assistance_kg,
  bodyweightKg: r.bodyweight_kg,
  loadMode: r.load_mode ?? 'external',
  exerciseType: r.exercise_type === 'time' ? 'time' : 'reps',
  durationSeconds: r.duration_seconds,
  plannedExerciseId: r.planned_exercise_id ?? null,
  rpe: r.rpe,
  completed: r.completed === 1,
});

const SET_SELECT = `SELECT s.*, e.name AS exercise_name, e.load_mode AS load_mode, e.exercise_type AS exercise_type
  FROM workout_sets s JOIN exercises e ON e.id = s.exercise_id`;

export const setInputSchema = z
  .object({
    repetitions: z.number().int().min(0, 'Repeticiones ≥ 0').max(500).nullable(),
    weightKg: z.number().min(0, 'Peso ≥ 0').max(500, 'Peso máximo 500 kg').nullable(),
    assistanceKg: z.number().min(0, 'Asistencia ≥ 0').max(200, 'Asistencia máxima 200 kg').nullable().default(null),
    bodyweightKg: z.number().min(30).max(300).nullable().default(null),
    durationSeconds: z.number().int().min(0, 'Segundos ≥ 0').max(3600, 'Máximo 1 hora').nullable().default(null),
    rpe: z.number().min(1).max(10).nullable().default(null),
    completed: z.boolean(),
  })
  .refine((v) => v.assistanceKg == null || v.bodyweightKg == null || v.assistanceKg < v.bodyweightKg, {
    message: 'La asistencia no puede ser igual o mayor que tu peso.',
    path: ['assistanceKg'],
  });
export type SetInput = z.input<typeof setInputSchema>;

export const workoutsRepo = {
  async getInProgress(db: Db, profileId: string): Promise<Workout | null> {
    const r = await db.getFirstAsync<WorkoutRow>(
      `SELECT * FROM workouts WHERE profile_id = ? AND status = 'in_progress' AND deleted_at IS NULL
       ORDER BY started_at DESC LIMIT 1`,
      [profileId],
    );
    return r ? mapW(r) : null;
  },

  async getById(db: Db, id: string): Promise<Workout | null> {
    const r = await db.getFirstAsync<WorkoutRow>('SELECT * FROM workouts WHERE id = ?', [id]);
    return r ? mapW(r) : null;
  },

  /** Inicia una sesión. Si ya hay una en curso, la devuelve (nunca dos a la vez). */
  async start(db: Db, profileId: string, templateId: string | null = null): Promise<Workout> {
    return transaction(db, async () => {
      const current = await workoutsRepo.getInProgress(db, profileId);
      if (current) return current;
      const id = newId();
      const now = nowIso();
      await db.runAsync(
        `INSERT INTO workouts (id, profile_id, template_id, started_at, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'in_progress', ?, ?)`,
        [id, profileId, templateId, now, now, now],
      );
      return (await workoutsRepo.getById(db, id))!;
    });
  },

  async listSets(db: Db, workoutId: string): Promise<WorkoutSet[]> {
    const rows = await db.getAllAsync<SetRow>(`${SET_SELECT} WHERE s.workout_id = ? ORDER BY s.rowid ASC`, [workoutId]);
    return rows.map(mapS);
  },

  /** Añade una serie al ejercicio, copiando los valores de la anterior si existe. */
  async addSet(db: Db, workoutId: string, exerciseId: string, values?: Partial<SetInput>): Promise<WorkoutSet> {
    return transaction(db, async () => {
      const prev = await db.getFirstAsync<SetRow>(
        `${SET_SELECT} WHERE s.workout_id = ? AND s.exercise_id = ? ORDER BY s.set_number DESC LIMIT 1`,
        [workoutId, exerciseId],
      );
      const v = setInputSchema.parse({
        repetitions: values?.repetitions ?? prev?.repetitions ?? null,
        weightKg: values?.weightKg ?? prev?.weight_kg ?? null,
        assistanceKg: values?.assistanceKg ?? prev?.assistance_kg ?? null,
        bodyweightKg: values?.bodyweightKg ?? prev?.bodyweight_kg ?? null,
        durationSeconds: values?.durationSeconds ?? prev?.duration_seconds ?? null,
        rpe: values?.rpe ?? null,
        completed: values?.completed ?? false,
      });
      const id = newId();
      await db.runAsync(
        `INSERT INTO workout_sets (id, workout_id, exercise_id, set_number, repetitions, weight_kg, assistance_kg, bodyweight_kg, duration_seconds, rpe, completed, planned_exercise_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, workoutId, exerciseId, (prev?.set_number ?? 0) + 1,
          v.repetitions, v.weightKg, v.assistanceKg, v.bodyweightKg, v.durationSeconds, v.rpe, v.completed ? 1 : 0,
          prev?.planned_exercise_id ?? null,
        ],
      );
      const row = await db.getFirstAsync<SetRow>(`${SET_SELECT} WHERE s.id = ?`, [id]);
      return mapS(row!);
    });
  },

  async updateSet(db: Db, setId: string, input: SetInput): Promise<void> {
    const v = setInputSchema.parse(input);
    await db.runAsync(
      `UPDATE workout_sets SET repetitions = ?, weight_kg = ?, assistance_kg = ?, bodyweight_kg = ?, duration_seconds = ?, rpe = ?, completed = ?
       WHERE id = ?`,
      [v.repetitions, v.weightKg, v.assistanceKg, v.bodyweightKg, v.durationSeconds, v.rpe, v.completed ? 1 : 0, setId],
    );
  },

  async deleteSet(db: Db, setId: string): Promise<void> {
    await db.runAsync('DELETE FROM workout_sets WHERE id = ?', [setId]);
  },

  /** Vuelve a insertar una serie borrada (botón «Deshacer»), con el mismo id y número. */
  async restoreSet(db: Db, set: WorkoutSet): Promise<void> {
    await db.runAsync(
      `INSERT OR IGNORE INTO workout_sets (id, workout_id, exercise_id, set_number, repetitions, weight_kg, assistance_kg, bodyweight_kg, duration_seconds, rpe, completed, planned_exercise_id)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
       WHERE EXISTS (SELECT 1 FROM workouts w WHERE w.id = ? AND w.status = 'in_progress')
         AND NOT EXISTS (SELECT 1 FROM workout_sets x WHERE x.workout_id = ? AND x.exercise_id = ? AND x.set_number = ?)`,
      [
        set.id, set.workoutId, set.exerciseId, set.setNumber, set.repetitions, set.weightKg, set.assistanceKg,
        set.bodyweightKg, set.durationSeconds, set.rpe, set.completed ? 1 : 0, set.plannedExerciseId, set.workoutId, set.workoutId, set.exerciseId, set.setNumber,
      ],
    );
  },

  /** Quita un ejercicio añadido por error: borra todas sus series de esta sesión (solo si sigue en curso). */
  async removeExercise(db: Db, workoutId: string, exerciseId: string): Promise<number> {
    const res = await db.runAsync(
      `DELETE FROM workout_sets WHERE workout_id = ? AND exercise_id = ?
         AND EXISTS (SELECT 1 FROM workouts w WHERE w.id = ? AND w.status = 'in_progress')`,
      [workoutId, exerciseId, workoutId],
    );
    return res.changes;
  },

  /** Series hechas la última vez que se completó este ejercicio (para precargar pesos). */
  async lastCompletedSets(db: Db, profileId: string, exerciseId: string, excludeWorkoutId?: string): Promise<WorkoutSet[]> {
    const last = await db.getFirstAsync<{ id: string }>(
      `SELECT w.id FROM workouts w
       WHERE w.profile_id = ? AND w.status = 'completed' AND w.deleted_at IS NULL AND w.id != ?
         AND EXISTS (SELECT 1 FROM workout_sets s WHERE s.workout_id = w.id AND s.exercise_id = ? AND s.completed = 1)
       ORDER BY w.started_at DESC LIMIT 1`,
      [profileId, excludeWorkoutId ?? '', exerciseId],
    );
    if (!last) return [];
    const rows = await db.getAllAsync<SetRow>(
      `${SET_SELECT} WHERE s.workout_id = ? AND s.exercise_id = ? AND s.completed = 1 ORDER BY s.set_number ASC`,
      [last.id, exerciseId],
    );
    return rows.map(mapS);
  },

  /** Series hechas en sesiones completadas desde `sinceIso` (para el volumen semanal). */
  async completedSetsSince(db: Db, profileId: string, sinceIso: string): Promise<Array<{ exerciseId: string; startedAt: string }>> {
    return db.getAllAsync<{ exerciseId: string; startedAt: string }>(
      `SELECT s.exercise_id AS exerciseId, w.started_at AS startedAt
       FROM workout_sets s JOIN workouts w ON w.id = s.workout_id
       WHERE w.profile_id = ? AND w.status = 'completed' AND w.deleted_at IS NULL AND s.completed = 1 AND w.started_at >= ?`,
      [profileId, sinceIso],
    );
  },

  /**
   * Cambia un ejercicio por otro en una sesión, conservando las series (reps, kg, hechas).
   * Recuerda el ejercicio previsto para seguir mostrando el objetivo de la rutina.
   * El ejercicio nuevo debe existir (ensureExercise) y no estar ya en la sesión.
   */
  async swapExercise(db: Db, workoutId: string, fromExerciseId: string, toExerciseId: string): Promise<number> {
    if (fromExerciseId === toExerciseId) return 0;
    return transaction(db, async () => {
      const clash = await db.getFirstAsync<{ n: number }>(
        'SELECT COUNT(*) AS n FROM workout_sets WHERE workout_id = ? AND exercise_id = ?',
        [workoutId, toExerciseId],
      );
      if ((clash?.n ?? 0) > 0) throw new Error('Ese ejercicio ya está en la sesión');
      const r = await db.runAsync(
        `UPDATE workout_sets SET exercise_id = ?, planned_exercise_id = COALESCE(planned_exercise_id, ?)
         WHERE workout_id = ? AND exercise_id = ?`,
        [toExerciseId, fromExerciseId, workoutId, fromExerciseId],
      );
      await db.runAsync('UPDATE workouts SET updated_at = ? WHERE id = ?', [nowIso(), workoutId]);
      return r.changes;
    });
  },

  async setEnergy(db: Db, workoutId: string, e: { kcal: number; met: number; minutes: number } | null): Promise<void> {
    await db.runAsync('UPDATE workouts SET energy_kcal = ?, energy_met = ?, energy_minutes = ?, updated_at = ? WHERE id = ?', [
      e?.kcal ?? null, e?.met ?? null, e?.minutes ?? null, nowIso(), workoutId,
    ]);
  },

  async setStatus(db: Db, id: string, status: 'completed' | 'abandoned', finishedAt: string): Promise<void> {
    await db.runAsync(`UPDATE workouts SET status = ?, finished_at = ?, updated_at = ? WHERE id = ?`, [status, finishedAt, finishedAt, id]);
  },

  /** Últimas sesiones terminadas con el nombre de su rutina (si tenían). */
  async listRecentCompleted(db: Db, profileId: string, limit = 10): Promise<Array<Workout & { templateName: string | null; completedSets: number }>> {
    const rows = await db.getAllAsync<WorkoutRow & { template_name: string | null; completed_sets: number }>(
      `SELECT w.*, t.name AS template_name,
         (SELECT COUNT(*) FROM workout_sets s WHERE s.workout_id = w.id AND s.completed = 1) AS completed_sets
       FROM workouts w LEFT JOIN workout_templates t ON t.id = w.template_id
       WHERE w.profile_id = ? AND w.status = 'completed' AND w.deleted_at IS NULL
       ORDER BY w.started_at DESC LIMIT ?`,
      [profileId, limit],
    );
    return rows.map((r) => ({ ...mapW(r), templateName: r.template_name, completedSets: r.completed_sets }));
  },

  async listCompletedSince(db: Db, profileId: string, sinceIso: string): Promise<Workout[]> {
    const rows = await db.getAllAsync<WorkoutRow>(
      `SELECT * FROM workouts WHERE profile_id = ? AND status = 'completed' AND deleted_at IS NULL AND started_at >= ?
       ORDER BY started_at DESC`,
      [profileId, sinceIso],
    );
    return rows.map(mapW);
  },
};
