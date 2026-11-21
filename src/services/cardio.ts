import { z } from 'zod';
import type { Db } from '@/database/types';
import { newId } from '@/database/ids';
import { bodyMetricsRepo } from '@/database/repositories/bodyMetrics';
import { usableBodyweight } from '@/features/training/load';
import {
  MAX_INCLINE_PCT,
  MAX_MINUTES,
  MAX_SPEED_KMH,
  MIN_SPEED_KMH,
  netKcal,
  type CardioMode,
} from '@/features/cardio/acsm';
import { localDateKey, nowIso } from '@/lib/time';
import { awardXp, type AwardResult } from './xp';

/** Minutos mínimos para que la sesión dé XP y cuente para RES. */
export const CARDIO_MIN_MINUTES = 10;
/** Meta semanal de la OMS: 150 min de actividad moderada. */
export const WEEKLY_CARDIO_MINUTES = 150;

export const cardioInputSchema = z.object({
  mode: z.enum(['walk', 'run']),
  speedKmh: z.number().min(MIN_SPEED_KMH).max(MAX_SPEED_KMH),
  inclinePct: z.number().min(0).max(MAX_INCLINE_PCT),
  minutes: z.number().gt(0).max(MAX_MINUTES),
});
export type CardioInput = z.infer<typeof cardioInputSchema>;

export interface CardioSession {
  id: string;
  mode: CardioMode;
  speedKmh: number;
  inclinePct: number;
  minutes: number;
  weightKg: number | null;
  kcal: number | null;
  startedAt: string;
  localDate: string;
}

interface Row {
  id: string;
  mode: CardioMode;
  speed_kmh: number;
  incline_pct: number;
  minutes: number;
  weight_kg: number | null;
  kcal: number | null;
  started_at: string;
  local_date: string;
}
const map = (r: Row): CardioSession => ({
  id: r.id,
  mode: r.mode,
  speedKmh: r.speed_kmh,
  inclinePct: r.incline_pct,
  minutes: r.minutes,
  weightKg: r.weight_kg,
  kcal: r.kcal,
  startedAt: r.started_at,
  localDate: r.local_date,
});

export async function cardioWeight(db: Db, profileId: string, now: Date = new Date()): Promise<number | null> {
  return usableBodyweight(await bodyMetricsRepo.latest(db, profileId), now);
}

export interface LogCardioResult {
  session: CardioSession;
  xp: AwardResult;
}

/** Guarda una sesión de caminadora (terminada ahora) y da su XP si dura ≥10 min. */
export async function logCardio(db: Db, profileId: string, input: CardioInput, now: Date = new Date()): Promise<LogCardioResult> {
  const v = cardioInputSchema.parse(input);
  const weightKg = await cardioWeight(db, profileId, now);
  const kcal = weightKg ? Math.round(netKcal({ ...v, weightKg })) : null;
  const id = newId();
  const startedAt = new Date(now.getTime() - v.minutes * 60_000).toISOString();
  const ts = nowIso();
  await db.runAsync(
    `INSERT INTO cardio_sessions (id, profile_id, mode, speed_kmh, incline_pct, minutes, weight_kg, kcal, started_at, local_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, profileId, v.mode, v.speedKmh, v.inclinePct, v.minutes, weightKg, kcal, startedAt, localDateKey(now), ts, ts],
  );
  const xp: AwardResult =
    v.minutes >= CARDIO_MIN_MINUTES
      ? await awardXp(db, { profileId, source: 'cardio', sourceId: id, idempotencyKey: `cardio:${id}`, at: now })
      : { awarded: 0, reason: 'ok' };
  const session = map((await db.getFirstAsync<Row>('SELECT * FROM cardio_sessions WHERE id = ?', [id]))!);
  return { session, xp };
}

export async function listCardio(db: Db, profileId: string, limit = 20): Promise<CardioSession[]> {
  const rows = await db.getAllAsync<Row>(
    `SELECT * FROM cardio_sessions WHERE profile_id = ? AND deleted_at IS NULL ORDER BY started_at DESC LIMIT ?`,
    [profileId, limit],
  );
  return rows.map(map);
}

export async function allCardio(db: Db, profileId: string): Promise<CardioSession[]> {
  const rows = await db.getAllAsync<Row>(
    `SELECT * FROM cardio_sessions WHERE profile_id = ? AND deleted_at IS NULL ORDER BY started_at ASC`,
    [profileId],
  );
  return rows.map(map);
}

export async function deleteCardio(db: Db, profileId: string, id: string): Promise<void> {
  await db.runAsync('UPDATE cardio_sessions SET deleted_at = ?, updated_at = ? WHERE id = ? AND profile_id = ?', [nowIso(), nowIso(), id, profileId]);
}

/** Minutos de caminadora en los últimos 7 días. */
export async function cardioMinutes7d(db: Db, profileId: string, now: Date = new Date()): Promise<number> {
  const from = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const r = await db.getFirstAsync<{ m: number | null }>(
    `SELECT SUM(minutes) AS m FROM cardio_sessions WHERE profile_id = ? AND deleted_at IS NULL AND started_at > ? AND started_at <= ?`,
    [profileId, from, now.toISOString()],
  );
  return r?.m ?? 0;
}

/** Línea lista para copiar en Fitia. */
export function fitiaLine(s: Pick<CardioSession, 'mode' | 'speedKmh' | 'inclinePct' | 'minutes' | 'kcal'>): string {
  const what = s.mode === 'walk' ? 'Caminata en cinta' : 'Carrera en cinta';
  const n = (x: number) => String(Math.round(x * 10) / 10).replace('.', ',');
  return `${what} · ${n(s.minutes)} min · ${n(s.speedKmh)} km/h · ${n(s.inclinePct)} % · ${s.kcal != null ? `${s.kcal} kcal` : 'kcal sin peso'}`;
}
