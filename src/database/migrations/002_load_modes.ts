import type { Migration } from './index';

/**
 * v2 — Tipos de carga y peso corporal por serie.
 * - exercises.load_mode: 'external' (pesas/máquina), 'bodyweight' (peso corporal ± lastre) o 'assisted' (peso corporal − asistencia).
 * - workout_sets.bodyweight_kg: foto del peso corporal al registrar la serie, para que la carga efectiva histórica no cambie.
 * Solo añade columnas con valores por defecto: los registros existentes se conservan intactos.
 */
export const m002LoadModes: Migration = {
  version: 2,
  name: 'load_modes_and_bodyweight_snapshot',
  statements: [
    `ALTER TABLE exercises ADD COLUMN load_mode TEXT NOT NULL DEFAULT 'external'
       CHECK (load_mode IN ('external','bodyweight','assisted'))`,
    `ALTER TABLE workout_sets ADD COLUMN bodyweight_kg REAL
       CHECK (bodyweight_kg IS NULL OR bodyweight_kg BETWEEN 30 AND 300)`,
  ],
};
