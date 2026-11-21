import type { Migration } from './index';

/**
 * v3 — Plan semanal y datos del perfil para los cálculos de energía.
 * - profiles.birth_year: año de nacimiento (para la edad en Mifflin-St Jeor, Fase 3).
 * - workout_template_exercises.notes: indicación corta del ejercicio en la rutina («opcional», «por pierna»…).
 * Solo añade columnas que admiten NULL: los datos existentes no cambian.
 */
export const m003PlanAndProfile: Migration = {
  version: 3,
  name: 'plan_notes_and_birth_year',
  statements: [
    `ALTER TABLE profiles ADD COLUMN birth_year INTEGER CHECK (birth_year IS NULL OR birth_year BETWEEN 1900 AND 2100)`,
    `ALTER TABLE workout_template_exercises ADD COLUMN notes TEXT`,
    `CREATE INDEX IF NOT EXISTS ix_template_exercises_template ON workout_template_exercises(template_id, position)`,
  ],
};
