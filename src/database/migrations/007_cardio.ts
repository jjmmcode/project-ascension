import type { Migration } from './index';

export const m007Cardio: Migration = {
  version: 7,
  name: 'cardio_sessions',
  statements: [
    `CREATE TABLE cardio_sessions (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      machine TEXT NOT NULL DEFAULT 'treadmill' CHECK (machine IN ('treadmill')),
      mode TEXT NOT NULL CHECK (mode IN ('walk','run')),
      speed_kmh REAL NOT NULL CHECK (speed_kmh > 0 AND speed_kmh <= 25),
      incline_pct REAL NOT NULL DEFAULT 0 CHECK (incline_pct >= 0 AND incline_pct <= 30),
      minutes REAL NOT NULL CHECK (minutes > 0 AND minutes <= 300),
      weight_kg REAL,
      kcal REAL,
      started_at TEXT NOT NULL,
      local_date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    )`,
    `CREATE INDEX idx_cardio_profile_date ON cardio_sessions(profile_id, local_date)`,
  ],
};
