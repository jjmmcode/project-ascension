import type { Migration } from './index';

/**
 * v6 — Penitencia por inactividad (entrega 3).
 * xp_events solo admite cantidades positivas; las pérdidas se guardan aparte y se restan del total.
 * kind: 'level_xp' (pierdes la XP del nivel actual) | 'level_down' (bajas un nivel).
 */
export const m006Penance: Migration = {
  version: 6,
  name: 'xp_penalties',
  statements: [
    `CREATE TABLE xp_penalties (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('level_xp', 'level_down')),
      amount INTEGER NOT NULL CHECK (amount >= 0),
      window_start TEXT NOT NULL,
      local_date TEXT NOT NULL,
      applied_at TEXT NOT NULL,
      idempotency_key TEXT NOT NULL UNIQUE
    )`,
    `CREATE INDEX ix_xp_penalties_profile ON xp_penalties(profile_id, applied_at)`,
  ],
};
