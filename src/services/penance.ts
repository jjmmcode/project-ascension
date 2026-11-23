import { z } from 'zod';
import type { Db } from '@/database/types';
import { transaction } from '@/database/transaction';
import { newId } from '@/database/ids';
import { settingsRepo } from '@/database/repositories/settings';
import { GENERAL_RANKS, levelFromXp, minLevelFor, totalXpForLevel, type Rank } from '@/features/progression/leveling';
import {
  addDays,
  badgeDamage,
  evaluatePenance,
  MAX_REST_DAYS,
  type PenanceEvent,
  type PenanceState,
  type RestPeriod,
} from '@/features/penance/engine';
import { localDateKey, nowIso } from '@/lib/time';
import { totalXp } from './xp';
import { getPassedRank, setPassedRank } from './progression';

const REST_KEY = 'rest.periods';
const MAX_LEVEL_KEY = 'level.max';
const restSchema = z.array(z.object({ start: z.string(), end: z.string() }));

export async function sessionDays(db: Db, profileId: string): Promise<string[]> {
  const rows = await db.getAllAsync<{ started_at: string }>(
    `SELECT started_at FROM workouts WHERE profile_id = ? AND status = 'completed' AND deleted_at IS NULL`,
    [profileId],
  );
  return rows.map((r) => localDateKey(new Date(r.started_at)));
}

export async function restPeriods(db: Db, profileId: string): Promise<RestPeriod[]> {
  return (await settingsRepo.get(db, profileId, REST_KEY, restSchema)) ?? [];
}

/** Activa el modo descanso desde hoy (máximo 14 días). */
export async function startRest(db: Db, profileId: string, now: Date = new Date()): Promise<RestPeriod> {
  const today = localDateKey(now);
  const periods = (await restPeriods(db, profileId)).filter((p) => p.end < today);
  const period = { start: today, end: addDays(today, MAX_REST_DAYS - 1) };
  await settingsRepo.set(db, profileId, REST_KEY, restSchema, [...periods, period]);
  return period;
}

/** Termina el modo descanso hoy (hoy ya cuenta como día normal). */
export async function endRest(db: Db, profileId: string, now: Date = new Date()): Promise<void> {
  const today = localDateKey(now);
  const periods = (await restPeriods(db, profileId))
    .map((p) => (p.start <= today && p.end >= today ? { ...p, end: addDays(today, -1) } : p))
    .filter((p) => p.end >= p.start);
  await settingsRepo.set(db, profileId, REST_KEY, restSchema, periods);
}

export async function activeRest(db: Db, profileId: string, now: Date = new Date()): Promise<RestPeriod | null> {
  const today = localDateKey(now);
  return (await restPeriods(db, profileId)).find((p) => p.start <= today && p.end >= today) ?? null;
}

/** XP que quita un fallo, según el total actual. */
export function penaltyAmount(kind: 'fail_xp' | 'fail_level', total: number): number {
  const st = levelFromXp(total);
  if (kind === 'fail_xp' || st.level <= 1) return Math.max(0, total - totalXpForLevel(st.level));
  return Math.max(0, total - totalXpForLevel(st.level - 1));
}

export interface PenanceSnapshot {
  state: PenanceState;
  applied: Array<{ kind: 'fail_xp' | 'fail_level'; amount: number }>;
  maxLevel: number;
  level: number;
  /** Ganas XP doble (memoria muscular) hasta recuperar tu nivel máximo. */
  comeback: boolean;
}

/** Evalúa la penitencia y aplica (una sola vez) los fallos vencidos. Se llama al abrir la app. */
export async function applyPenance(db: Db, profileId: string, now: Date = new Date()): Promise<PenanceSnapshot> {
  const state = evaluatePenance(await sessionDays(db, profileId), await restPeriods(db, profileId), localDateKey(now));
  const applied: PenanceSnapshot['applied'] = [];
  // Guardar el nivel máximo antes de aplicar pérdidas (para la XP doble de regreso)
  const before = levelFromXp(await totalXp(db, profileId)).level;
  const prevMax = (await settingsRepo.get(db, profileId, MAX_LEVEL_KEY, z.number())) ?? 1;
  if (before > prevMax) await settingsRepo.set(db, profileId, MAX_LEVEL_KEY, z.number(), before);
  await transaction(db, async (db) => {
    for (const e of state.events) {
      if (e.kind !== 'fail_xp' && e.kind !== 'fail_level') continue;
      const key = `penance:${profileId}:${e.kind}:${e.windowStart}`;
      const done = await db.getFirstAsync<{ id: string }>('SELECT id FROM xp_penalties WHERE idempotency_key = ?', [key]);
      if (done) continue;
      const amount = penaltyAmount(e.kind, await totalXp(db, profileId));
      await db.runAsync(
        `INSERT INTO xp_penalties (id, profile_id, kind, amount, window_start, local_date, applied_at, idempotency_key)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [newId(), profileId, e.kind === 'fail_xp' ? 'level_xp' : 'level_down', amount, e.windowStart, e.date, nowIso(), key],
      );
      applied.push({ kind: e.kind, amount });
    }
  });
  const level = levelFromXp(await totalXp(db, profileId)).level;
  const stored = (await settingsRepo.get(db, profileId, MAX_LEVEL_KEY, z.number())) ?? 1;
  const maxLevel = Math.max(stored, level);
  if (maxLevel !== stored) await settingsRepo.set(db, profileId, MAX_LEVEL_KEY, z.number(), maxLevel);
  return { state, applied, maxLevel, level, comeback: level < maxLevel };
}

export async function maxLevelReached(db: Db, profileId: string): Promise<number> {
  return (await settingsRepo.get(db, profileId, MAX_LEVEL_KEY, z.number())) ?? 1;
}

export function damageFor(level: number, rank: Rank): 0 | 1 | 2 | 3 {
  return badgeDamage(level, minLevelFor(rank));
}

export interface Simulation {
  days: number;
  date: string;
  state: PenanceState;
  /** Fallos que se aplicarían (además de los ya aplicados). */
  pending: Array<{ event: PenanceEvent; amount: number }>;
  levelNow: number;
  levelThen: number;
  xpThen: number;
}

/** Simulador de solo lectura: qué pasaría si no entrenas en `days` días. No guarda nada. */
export async function simulatePenance(db: Db, profileId: string, days: number, now: Date = new Date()): Promise<Simulation> {
  const future = new Date(now.getTime() + days * 86_400_000);
  const date = localDateKey(future);
  const state = evaluatePenance(await sessionDays(db, profileId), await restPeriods(db, profileId), date);
  let total = await totalXp(db, profileId);
  const levelNow = levelFromXp(total).level;
  const pending: Simulation['pending'] = [];
  for (const e of state.events) {
    if (e.kind !== 'fail_xp' && e.kind !== 'fail_level') continue;
    const key = `penance:${profileId}:${e.kind}:${e.windowStart}`;
    if (await db.getFirstAsync<{ id: string }>('SELECT id FROM xp_penalties WHERE idempotency_key = ?', [key])) continue;
    const amount = penaltyAmount(e.kind, total);
    total -= amount;
    pending.push({ event: e, amount });
  }
  return { days, date, state, pending, levelNow, levelThen: levelFromXp(total).level, xpThen: total };
}

// ─── Pérdida de rango (aprobado el 23-11-2026) ──────────────────────────────

/** Días seguidos con el emblema destrozado (3+ niveles bajo el mínimo del rango) para bajar una letra. */
export const DEMOTION_DAYS = 7;
const SHATTERED_KEY = 'badge.shatteredSince';
const DEMOTIONS_KEY = 'rank.demotions';
const dateKeySchema = z.string().nullable();
const demotionsSchema = z.array(z.object({ from: z.string(), to: z.string(), date: z.string() }));

export interface RankDecay {
  /** Rango perdido ahora (una vez). */
  demoted: { from: Rank; to: Rank } | null;
  /** Días que faltan para perder el rango si el emblema sigue destrozado; null si no está destrozado. */
  daysLeft: number | null;
}

/**
 * Si el emblema lleva 7 días seguidos destrozado, el rango baja una letra (máx. una por semana).
 * El modo descanso congela la cuenta. Se recupera volviendo a aprobar el examen (sin XP de examen repetida).
 */
export async function applyRankDecay(db: Db, profileId: string, now: Date = new Date()): Promise<RankDecay> {
  const today = localDateKey(now);
  const rank = await getPassedRank(db, profileId);
  const level = levelFromXp(await totalXp(db, profileId)).level;
  const since = await settingsRepo.get(db, profileId, SHATTERED_KEY, dateKeySchema);
  if (rank === 'E' || damageFor(level, rank) < 3) {
    if (since) await settingsRepo.set(db, profileId, SHATTERED_KEY, dateKeySchema, null);
    return { demoted: null, daysLeft: null };
  }
  if (!since || (await activeRest(db, profileId))) {
    // Empieza (o se congela, en descanso) la cuenta desde hoy
    await settingsRepo.set(db, profileId, SHATTERED_KEY, dateKeySchema, today);
    return { demoted: null, daysLeft: DEMOTION_DAYS };
  }
  const due = addDays(since, DEMOTION_DAYS);
  if (today < due) return { demoted: null, daysLeft: daysBetween(today, due) };
  const to = GENERAL_RANKS[GENERAL_RANKS.indexOf(rank) - 1]!;
  await transaction(db, async (db) => {
    await setPassedRank(db, profileId, to);
    await settingsRepo.set(db, profileId, SHATTERED_KEY, dateKeySchema, today);
    const history = (await settingsRepo.get(db, profileId, DEMOTIONS_KEY, demotionsSchema)) ?? [];
    await settingsRepo.set(db, profileId, DEMOTIONS_KEY, demotionsSchema, [...history, { from: rank, to, date: today }]);
  });
  const stillShattered = damageFor(level, to) >= 3;
  if (!stillShattered) await settingsRepo.set(db, profileId, SHATTERED_KEY, dateKeySchema, null);
  return { demoted: { from: rank, to }, daysLeft: stillShattered ? DEMOTION_DAYS : null };
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
}
