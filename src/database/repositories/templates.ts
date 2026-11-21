import { z } from 'zod';
import type { Db } from '../types';
import { newId } from '../ids';
import { transaction } from '../transaction';
import { nowIso } from '@/lib/time';

export type TemplateKind = 'calisthenics' | 'gym' | 'hybrid' | 'cardio';

export interface Template {
  id: string;
  profileId: string;
  name: string;
  description: string | null;
  kind: TemplateKind;
  exerciseCount: number;
}

export interface TemplateExercise {
  id: string;
  templateId: string;
  exerciseId: string;
  exerciseName: string;
  exerciseType: 'reps' | 'time';
  position: number;
  sets: number;
  target: string;
  notes: string | null;
}

export interface ScheduleDay {
  weekday: number;
  templateId: string | null;
}

interface TRow {
  id: string;
  profile_id: string;
  name: string;
  description: string | null;
  kind: TemplateKind;
  exercise_count: number;
}
interface TERow {
  id: string;
  template_id: string;
  exercise_id: string;
  exercise_name: string;
  exercise_type: string | null;
  position: number;
  target_sets: number;
  target_reps: string;
  notes: string | null;
}

const mapT = (r: TRow): Template => ({
  id: r.id,
  profileId: r.profile_id,
  name: r.name,
  description: r.description,
  kind: r.kind,
  exerciseCount: r.exercise_count,
});
const mapTE = (r: TERow): TemplateExercise => ({
  id: r.id,
  templateId: r.template_id,
  exerciseId: r.exercise_id,
  exerciseName: r.exercise_name,
  exerciseType: r.exercise_type === 'time' ? 'time' : 'reps',
  position: r.position,
  sets: r.target_sets,
  target: r.target_reps,
  notes: r.notes,
});

export const templateInputSchema = z.object({
  name: z.string().trim().min(1, 'Ponle un nombre a la rutina').max(40, 'Máximo 40 caracteres'),
  description: z.string().trim().max(200).nullable().default(null),
  kind: z.enum(['calisthenics', 'gym', 'hybrid', 'cardio']).default('gym'),
});

export const templateExerciseInputSchema = z.object({
  sets: z.number().int().min(1, 'Mínimo 1 serie').max(20, 'Máximo 20 series'),
  target: z.string().trim().min(1, 'Indica el objetivo (p. ej. 12 o 30 s)').max(24, 'Máximo 24 caracteres'),
  notes: z.string().trim().max(80).nullable().default(null),
});
export type TemplateExerciseInput = z.input<typeof templateExerciseInputSchema>;

const T_SELECT = `SELECT t.*, (SELECT COUNT(*) FROM workout_template_exercises x WHERE x.template_id = t.id) AS exercise_count
  FROM workout_templates t`;
const TE_SELECT = `SELECT x.*, e.name AS exercise_name, e.exercise_type AS exercise_type
  FROM workout_template_exercises x JOIN exercises e ON e.id = x.exercise_id`;

export const templatesRepo = {
  async list(db: Db, profileId: string): Promise<Template[]> {
    const rows = await db.getAllAsync<TRow>(`${T_SELECT} WHERE t.profile_id = ? AND t.deleted_at IS NULL ORDER BY t.created_at ASC`, [profileId]);
    return rows.map(mapT);
  },

  async get(db: Db, id: string): Promise<Template | null> {
    const r = await db.getFirstAsync<TRow>(`${T_SELECT} WHERE t.id = ? AND t.deleted_at IS NULL`, [id]);
    return r ? mapT(r) : null;
  },

  async exercises(db: Db, templateId: string): Promise<TemplateExercise[]> {
    const rows = await db.getAllAsync<TERow>(`${TE_SELECT} WHERE x.template_id = ? ORDER BY x.position ASC`, [templateId]);
    return rows.map(mapTE);
  },

  async create(db: Db, profileId: string, input: z.input<typeof templateInputSchema>): Promise<string> {
    const v = templateInputSchema.parse(input);
    const id = newId();
    const now = nowIso();
    await db.runAsync(
      `INSERT INTO workout_templates (id, profile_id, name, description, kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, profileId, v.name, v.description, v.kind, now, now],
    );
    return id;
  },

  async rename(db: Db, id: string, name: string): Promise<void> {
    const v = templateInputSchema.shape.name.parse(name);
    await db.runAsync('UPDATE workout_templates SET name = ?, updated_at = ? WHERE id = ?', [v, nowIso(), id]);
  },

  /** Borrado lógico: las sesiones pasadas conservan su referencia; el día del plan queda libre. */
  async remove(db: Db, id: string): Promise<void> {
    await transaction(db, async () => {
      await db.runAsync('UPDATE workout_templates SET deleted_at = ?, updated_at = ? WHERE id = ?', [nowIso(), nowIso(), id]);
      await db.runAsync('UPDATE workout_schedule SET template_id = NULL, is_rest = 1 WHERE template_id = ?', [id]);
    });
  },

  /** Deshace un borrado lógico (los días que la usaban no se reasignan solos). */
  async restore(db: Db, id: string): Promise<void> {
    await db.runAsync('UPDATE workout_templates SET deleted_at = NULL, updated_at = ? WHERE id = ?', [nowIso(), id]);
  },

  /** El ejercicio debe existir en `exercises` (ensureExercise). Se añade al final. */
  async addExercise(db: Db, templateId: string, exerciseId: string, input: TemplateExerciseInput): Promise<string> {
    const v = templateExerciseInputSchema.parse(input);
    return transaction(db, async () => {
      const max = await db.getFirstAsync<{ p: number | null }>(
        'SELECT MAX(position) AS p FROM workout_template_exercises WHERE template_id = ?',
        [templateId],
      );
      const id = newId();
      await db.runAsync(
        `INSERT INTO workout_template_exercises (id, template_id, exercise_id, position, target_sets, target_reps, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, templateId, exerciseId, (max?.p ?? 0) + 1, v.sets, v.target, v.notes],
      );
      await db.runAsync('UPDATE workout_templates SET updated_at = ? WHERE id = ?', [nowIso(), templateId]);
      return id;
    });
  },

  async updateExercise(db: Db, rowId: string, input: TemplateExerciseInput): Promise<void> {
    const v = templateExerciseInputSchema.parse(input);
    await db.runAsync('UPDATE workout_template_exercises SET target_sets = ?, target_reps = ?, notes = ? WHERE id = ?', [
      v.sets, v.target, v.notes, rowId,
    ]);
  },

  async removeExercise(db: Db, rowId: string): Promise<void> {
    await db.runAsync('DELETE FROM workout_template_exercises WHERE id = ?', [rowId]);
  },

  /** Sube o baja un ejercicio intercambiando su posición con el vecino. */
  async move(db: Db, rowId: string, direction: -1 | 1): Promise<void> {
    await transaction(db, async () => {
      const row = await db.getFirstAsync<{ template_id: string; position: number }>(
        'SELECT template_id, position FROM workout_template_exercises WHERE id = ?',
        [rowId],
      );
      if (!row) return;
      const neighbor = await db.getFirstAsync<{ id: string; position: number }>(
        direction < 0
          ? 'SELECT id, position FROM workout_template_exercises WHERE template_id = ? AND position < ? ORDER BY position DESC LIMIT 1'
          : 'SELECT id, position FROM workout_template_exercises WHERE template_id = ? AND position > ? ORDER BY position ASC LIMIT 1',
        [row.template_id, row.position],
      );
      if (!neighbor) return;
      // Posición temporal negativa para no chocar con UNIQUE (template_id, position).
      await db.runAsync('UPDATE workout_template_exercises SET position = ? WHERE id = ?', [-row.position, rowId]);
      await db.runAsync('UPDATE workout_template_exercises SET position = ? WHERE id = ?', [row.position, neighbor.id]);
      await db.runAsync('UPDATE workout_template_exercises SET position = ? WHERE id = ?', [neighbor.position, rowId]);
    });
  },

  async schedule(db: Db, profileId: string): Promise<ScheduleDay[]> {
    const rows = await db.getAllAsync<{ weekday: number; template_id: string | null }>(
      `SELECT s.weekday, CASE WHEN t.deleted_at IS NULL THEN s.template_id ELSE NULL END AS template_id
       FROM workout_schedule s LEFT JOIN workout_templates t ON t.id = s.template_id
       WHERE s.profile_id = ?`,
      [profileId],
    );
    const byDay = new Map(rows.map((r) => [r.weekday, r.template_id]));
    return [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, templateId: byDay.get(weekday) ?? null }));
  },

  /** Asigna una rutina a un día (1 = lunes … 7 = domingo); null = descanso. */
  async setDay(db: Db, profileId: string, weekday: number, templateId: string | null): Promise<void> {
    z.number().int().min(1).max(7).parse(weekday);
    await db.runAsync(
      `INSERT INTO workout_schedule (id, profile_id, weekday, template_id, is_rest) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (profile_id, weekday) DO UPDATE SET template_id = excluded.template_id, is_rest = excluded.is_rest`,
      [newId(), profileId, weekday, templateId, templateId ? 0 : 1],
    );
  },
};
