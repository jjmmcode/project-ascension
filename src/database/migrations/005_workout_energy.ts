import type { Migration } from './index';

/**
 * v5 — Gasto energético estimado por sesión (kcal netas, MET usado y minutos considerados).
 * NULL cuando no se pudo estimar (p. ej. sin peso corporal reciente).
 */
export const m005WorkoutEnergy: Migration = {
  version: 5,
  name: 'workout_energy',
  statements: [
    `ALTER TABLE workouts ADD COLUMN energy_kcal REAL CHECK (energy_kcal IS NULL OR energy_kcal BETWEEN 0 AND 5000)`,
    `ALTER TABLE workouts ADD COLUMN energy_met REAL CHECK (energy_met IS NULL OR energy_met BETWEEN 1 AND 20)`,
    `ALTER TABLE workouts ADD COLUMN energy_minutes REAL CHECK (energy_minutes IS NULL OR energy_minutes >= 0)`,
  ],
};
