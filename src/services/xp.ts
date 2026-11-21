import type { Db } from '@/database/types';
import { newId } from '@/database/ids';
import { transaction } from '@/database/transaction';
import { localDateKey, nowIso } from '@/lib/time';

/**
 * Recompensas base (docs/RPG_SYSTEM.md). Los topes diarios evitan "farmear" XP
 * y no premian entrenar de más.
 */
export const XP_RULES = {
  workout: { amount: 100, dailyCap: 100 },
  /** Memoria muscular: recuperar un punto de atributo perdido por inactividad. */
  recovery: { amount: 25, dailyCap: 75 },
  /** Misión secundaria semanal (músculo más débil). */
  quest: { amount: 50, dailyCap: 50 },
  /** Examen de rango aprobado (una vez por rango). */
  exam: { amount: 200, dailyCap: 1800 },
  /** Memoria muscular tras una penitencia: XP doble en sesiones hasta recuperar el nivel máximo. */
  comeback: { amount: 100, dailyCap: 100 },
  /** Caminadora (Fase 2): sesión de ≥10 min, una vez al día. */
  cardio: { amount: 50, dailyCap: 50 },
} as const;

export type XpSource = keyof typeof XP_RULES;

export interface AwardResult {
  awarded: number;
  reason: 'ok' | 'duplicate' | 'daily_cap';
}

/**
 * Otorga XP de forma idempotente: la misma `idempotencyKey` nunca suma dos veces
 * (restricción UNIQUE en BD) y se respeta el tope diario por tipo de fuente.
 */
export async function awardXp(
  db: Db,
  args: { profileId: string; source: XpSource; sourceId: string; idempotencyKey: string; at?: Date },
): Promise<AwardResult> {
  const rule = XP_RULES[args.source];
  const at = args.at ?? new Date();
  const day = localDateKey(at);

  return transaction(db, async () => {
    const dup = await db.getFirstAsync<{ id: string }>('SELECT id FROM xp_events WHERE idempotency_key = ?', [args.idempotencyKey]);
    if (dup) return { awarded: 0, reason: 'duplicate' as const };

    const today = await db.getFirstAsync<{ total: number | null }>(
      'SELECT SUM(amount) AS total FROM xp_events WHERE profile_id = ? AND source_type = ? AND local_date = ?',
      [args.profileId, args.source, day],
    );
    const remaining = rule.dailyCap - (today?.total ?? 0);
    if (remaining <= 0) return { awarded: 0, reason: 'daily_cap' as const };

    const amount = Math.min(rule.amount, remaining);
    await db.runAsync(
      `INSERT OR IGNORE INTO xp_events (id, profile_id, quest_id, source_type, source_id, amount, local_date, awarded_at, idempotency_key)
       VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?)`,
      [newId(), args.profileId, args.source, args.sourceId, amount, day, nowIso(), args.idempotencyKey],
    );
    return { awarded: amount, reason: 'ok' as const };
  });
}

/** XP total = ganada − perdida por penitencia (nunca negativa). */
export async function totalXp(db: Db, profileId: string): Promise<number> {
  const r = await db.getFirstAsync<{ total: number | null }>(
    `SELECT COALESCE((SELECT SUM(amount) FROM xp_events WHERE profile_id = ?), 0)
          - COALESCE((SELECT SUM(amount) FROM xp_penalties WHERE profile_id = ?), 0) AS total`,
    [profileId, profileId],
  );
  return Math.max(0, r?.total ?? 0);
}
