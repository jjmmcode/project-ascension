import type { Migration } from './index';

/**
 * v8 — Corrección de datos: asistencia anotada como lastre.
 * Antes, dominadas y fondos solo admitían lastre, así que los kg de ayuda de la máquina
 * se sumaban al peso corporal. Joel confirmó que el 23 y el 24-11-2026 (hora de Chile, UTC−3)
 * todos esos kg fueron asistencia, no lastre: se mueven de weight_kg a assistance_kg.
 * Solo toca ejercicios de peso corporal de esas sesiones; el resto queda intacto.
 */
export const m008AssistanceFix: Migration = {
  version: 8,
  name: 'assistance_logged_as_added_weight_2026_11_23_24',
  statements: [
    `UPDATE workout_sets
        SET assistance_kg = weight_kg, weight_kg = NULL
      WHERE weight_kg > 0
        AND (assistance_kg IS NULL OR assistance_kg = 0)
        AND exercise_id IN (SELECT id FROM exercises WHERE load_mode = 'bodyweight')
        AND workout_id IN (
          SELECT id FROM workouts
           WHERE started_at >= '2026-11-23T03:00:00' AND started_at < '2026-11-25T03:00:00'
        )`,
  ],
};
