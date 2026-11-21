import type { Migration } from './index';

/**
 * v4 — Cambio de ejercicio dentro de una sesión.
 * workout_sets.planned_exercise_id: ejercicio que la rutina tenía previsto cuando se cambió por otro
 * (p. ej. press militar con barra → press de hombro en máquina). Sirve para seguir mostrando el objetivo.
 */
export const m004ExerciseSwap: Migration = {
  version: 4,
  name: 'exercise_swap',
  statements: [`ALTER TABLE workout_sets ADD COLUMN planned_exercise_id TEXT REFERENCES exercises(id)`],
};
