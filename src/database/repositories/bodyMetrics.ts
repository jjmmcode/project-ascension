import type { Db, DataStatus } from '../types';
import { newId } from '../ids';
import { nowIso } from '@/lib/time';
import { bodyMetricInputSchema, type BodyMetricInput } from '@/features/measurements/schema';

export interface BodyMetric {
  id: string;
  profileId: string;
  measuredAt: string;
  weightKg: number | null;
  waistCm: number | null;
  bodyFatPercentage: number | null;
  skeletalMuscleKg: number | null;
  bodyFatKg: number | null;
  bmrKcal: number | null;
  source: string;
  dataStatus: DataStatus;
  notes: string | null;
}

interface Row {
  id: string;
  profile_id: string;
  measured_at: string;
  weight_kg: number | null;
  waist_cm: number | null;
  body_fat_percentage: number | null;
  skeletal_muscle_kg: number | null;
  body_fat_kg: number | null;
  bmr_kcal: number | null;
  measurement_source: string;
  data_status: DataStatus;
  notes: string | null;
}

const map = (r: Row): BodyMetric => ({
  id: r.id,
  profileId: r.profile_id,
  measuredAt: r.measured_at,
  weightKg: r.weight_kg,
  waistCm: r.waist_cm,
  bodyFatPercentage: r.body_fat_percentage,
  skeletalMuscleKg: r.skeletal_muscle_kg,
  bodyFatKg: r.body_fat_kg,
  bmrKcal: r.bmr_kcal,
  source: r.measurement_source,
  dataStatus: r.data_status,
  notes: r.notes,
});

export const bodyMetricsRepo = {
  async create(db: Db, profileId: string, input: BodyMetricInput): Promise<BodyMetric> {
    const m = bodyMetricInputSchema.parse(input);
    const id = newId();
    const now = nowIso();
    await db.runAsync(
      `INSERT INTO body_metrics (id, profile_id, measured_at, weight_kg, waist_cm, body_fat_percentage,
         skeletal_muscle_kg, body_fat_kg, bmr_kcal, measurement_source, data_status, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, profileId, m.measuredAt, m.weightKg, m.waistCm, m.bodyFatPercentage,
        m.skeletalMuscleKg, m.bodyFatKg, m.bmrKcal, m.source, m.dataStatus, m.notes, now, now,
      ],
    );
    const row = await db.getFirstAsync<Row>('SELECT * FROM body_metrics WHERE id = ?', [id]);
    return map(row!);
  },

  /** Más reciente por fecha de medición (no por fecha de carga), excluyendo borrados. */
  async latest(db: Db, profileId: string): Promise<BodyMetric | null> {
    const row = await db.getFirstAsync<Row>(
      `SELECT * FROM body_metrics WHERE profile_id = ? AND deleted_at IS NULL
       ORDER BY measured_at DESC LIMIT 1`,
      [profileId],
    );
    return row ? map(row) : null;
  },

  /** Peso confirmado más cercano a una fecha, dentro de ±maxDays (para sesiones pasadas). */
  async confirmedWeightNear(db: Db, profileId: string, atIso: string, maxDays = 30): Promise<number | null> {
    const row = await db.getFirstAsync<{ weight_kg: number }>(
      `SELECT weight_kg FROM body_metrics
       WHERE profile_id = ? AND deleted_at IS NULL AND data_status = 'confirmed' AND weight_kg IS NOT NULL
         AND ABS(julianday(measured_at) - julianday(?)) <= ?
       ORDER BY ABS(julianday(measured_at) - julianday(?)) ASC LIMIT 1`,
      [profileId, atIso, maxDays, atIso],
    );
    return row?.weight_kg ?? null;
  },

  async list(db: Db, profileId: string): Promise<BodyMetric[]> {
    const rows = await db.getAllAsync<Row>(
      `SELECT * FROM body_metrics WHERE profile_id = ? AND deleted_at IS NULL ORDER BY measured_at ASC`,
      [profileId],
    );
    return rows.map(map);
  },

  async softDelete(db: Db, id: string): Promise<void> {
    const now = nowIso();
    await db.runAsync('UPDATE body_metrics SET deleted_at = ?, updated_at = ? WHERE id = ?', [now, now, id]);
  },
};
