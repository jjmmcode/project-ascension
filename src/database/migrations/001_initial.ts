import type { Migration } from './index';

/** Esquema completo v1. Ver docs/DATA_MODEL.md. */
export const m001Initial: Migration = {
  version: 1,
  name: 'initial_schema',
  statements: [
    `CREATE TABLE profiles (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 40),
      height_cm REAL CHECK (height_cm IS NULL OR height_cm BETWEEN 100 AND 250),
      height_status TEXT NOT NULL DEFAULT 'estimated' CHECK (height_status IN ('confirmed','historical','estimated')),
      timezone TEXT NOT NULL DEFAULT 'America/Santiago',
      onboarding_completed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,

    `CREATE TABLE settings (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (profile_id, key)
    )`,

    `CREATE TABLE goals (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      goal_type TEXT NOT NULL,
      target_value REAL NOT NULL CHECK (target_value >= 0),
      unit TEXT NOT NULL,
      start_date TEXT NOT NULL,
      target_date TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived','achieved')),
      data_status TEXT NOT NULL DEFAULT 'confirmed' CHECK (data_status IN ('confirmed','historical','estimated')),
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE UNIQUE INDEX ux_goals_active ON goals(profile_id, goal_type) WHERE status = 'active'`,

    `CREATE TABLE body_metrics (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      measured_at TEXT NOT NULL,
      weight_kg REAL CHECK (weight_kg IS NULL OR weight_kg BETWEEN 30 AND 300),
      waist_cm REAL CHECK (waist_cm IS NULL OR waist_cm BETWEEN 40 AND 200),
      body_fat_percentage REAL CHECK (body_fat_percentage IS NULL OR body_fat_percentage BETWEEN 2 AND 70),
      skeletal_muscle_kg REAL CHECK (skeletal_muscle_kg IS NULL OR skeletal_muscle_kg BETWEEN 5 AND 100),
      body_fat_kg REAL CHECK (body_fat_kg IS NULL OR body_fat_kg BETWEEN 1 AND 200),
      bmr_kcal REAL CHECK (bmr_kcal IS NULL OR bmr_kcal BETWEEN 500 AND 5000),
      extra_json TEXT,
      measurement_source TEXT NOT NULL,
      data_status TEXT NOT NULL DEFAULT 'confirmed' CHECK (data_status IN ('confirmed','historical','estimated')),
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    )`,
    `CREATE INDEX ix_body_metrics_profile_date ON body_metrics(profile_id, measured_at)`,

    `CREATE TABLE progress_photos (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      taken_at TEXT NOT NULL,
      file_uri TEXT NOT NULL,
      pose TEXT,
      created_at TEXT NOT NULL,
      deleted_at TEXT
    )`,

    `CREATE TABLE exercises (
      id TEXT PRIMARY KEY,
      profile_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      primary_muscle TEXT NOT NULL,
      equipment TEXT NOT NULL,
      exercise_type TEXT NOT NULL CHECK (exercise_type IN ('reps','time','distance')),
      is_bodyweight INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      UNIQUE (profile_id, name)
    )`,

    `CREATE TABLE workout_templates (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      kind TEXT NOT NULL CHECK (kind IN ('calisthenics','gym','hybrid','cardio')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    )`,

    `CREATE TABLE workout_template_exercises (
      id TEXT PRIMARY KEY,
      template_id TEXT NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
      exercise_id TEXT NOT NULL REFERENCES exercises(id),
      position INTEGER NOT NULL,
      target_sets INTEGER NOT NULL CHECK (target_sets BETWEEN 1 AND 20),
      target_reps TEXT NOT NULL,
      rest_seconds INTEGER,
      UNIQUE (template_id, position)
    )`,

    `CREATE TABLE workout_schedule (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      weekday INTEGER NOT NULL CHECK (weekday BETWEEN 1 AND 7),
      template_id TEXT REFERENCES workout_templates(id) ON DELETE SET NULL,
      is_rest INTEGER NOT NULL DEFAULT 0,
      UNIQUE (profile_id, weekday)
    )`,

    `CREATE TABLE workouts (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      template_id TEXT REFERENCES workout_templates(id) ON DELETE SET NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','abandoned')),
      session_rpe REAL CHECK (session_rpe IS NULL OR session_rpe BETWEEN 1 AND 10),
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    )`,
    `CREATE INDEX ix_workouts_profile_date ON workouts(profile_id, started_at)`,

    `CREATE TABLE workout_sets (
      id TEXT PRIMARY KEY,
      workout_id TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
      exercise_id TEXT NOT NULL REFERENCES exercises(id),
      set_number INTEGER NOT NULL CHECK (set_number >= 1),
      repetitions INTEGER CHECK (repetitions IS NULL OR repetitions BETWEEN 0 AND 500),
      weight_kg REAL CHECK (weight_kg IS NULL OR weight_kg BETWEEN 0 AND 500),
      assistance_kg REAL CHECK (assistance_kg IS NULL OR assistance_kg BETWEEN 0 AND 200),
      duration_seconds INTEGER CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
      distance_m REAL CHECK (distance_m IS NULL OR distance_m >= 0),
      rpe REAL CHECK (rpe IS NULL OR rpe BETWEEN 1 AND 10),
      completed INTEGER NOT NULL DEFAULT 0,
      UNIQUE (workout_id, exercise_id, set_number)
    )`,

    `CREATE TABLE foods (
      id TEXT PRIMARY KEY,
      profile_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      brand TEXT,
      calories_per_100g REAL NOT NULL CHECK (calories_per_100g BETWEEN 0 AND 900),
      protein_per_100g REAL NOT NULL CHECK (protein_per_100g BETWEEN 0 AND 100),
      carbs_per_100g REAL NOT NULL CHECK (carbs_per_100g BETWEEN 0 AND 100),
      fat_per_100g REAL NOT NULL CHECK (fat_per_100g BETWEEN 0 AND 100),
      serving_g REAL CHECK (serving_g IS NULL OR serving_g > 0),
      serving_label TEXT,
      source TEXT NOT NULL,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    )`,

    `CREATE TABLE food_logs (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      food_id TEXT REFERENCES foods(id) ON DELETE SET NULL,
      food_name_snapshot TEXT NOT NULL,
      consumed_at TEXT NOT NULL,
      local_date TEXT NOT NULL,
      meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast','lunch','dinner','snack')),
      quantity_g REAL NOT NULL CHECK (quantity_g > 0 AND quantity_g <= 5000),
      calories_snapshot REAL NOT NULL CHECK (calories_snapshot >= 0),
      protein_snapshot REAL NOT NULL CHECK (protein_snapshot >= 0),
      carbs_snapshot REAL NOT NULL CHECK (carbs_snapshot >= 0),
      fat_snapshot REAL NOT NULL CHECK (fat_snapshot >= 0),
      created_at TEXT NOT NULL,
      deleted_at TEXT
    )`,
    `CREATE INDEX ix_food_logs_day ON food_logs(profile_id, local_date)`,

    `CREATE TABLE water_logs (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      consumed_at TEXT NOT NULL,
      local_date TEXT NOT NULL,
      quantity_ml INTEGER NOT NULL CHECK (quantity_ml BETWEEN 1 AND 3000),
      created_at TEXT NOT NULL,
      deleted_at TEXT
    )`,
    `CREATE INDEX ix_water_logs_day ON water_logs(profile_id, local_date)`,

    `CREATE TABLE habits (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'supplement',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE habit_logs (
      id TEXT PRIMARY KEY,
      habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
      local_date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (habit_id, local_date)
    )`,

    `CREATE TABLE quests (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      frequency TEXT NOT NULL CHECK (frequency IN ('daily','weekly')),
      condition_type TEXT NOT NULL,
      condition_value REAL NOT NULL,
      xp_reward INTEGER NOT NULL CHECK (xp_reward BETWEEN 0 AND 1000),
      active INTEGER NOT NULL DEFAULT 1
    )`,

    `CREATE TABLE quest_progress (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      quest_id TEXT NOT NULL REFERENCES quests(id),
      period_key TEXT NOT NULL,
      progress REAL NOT NULL DEFAULT 0,
      completed_at TEXT,
      UNIQUE (profile_id, quest_id, period_key)
    )`,

    `CREATE TABLE xp_events (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      quest_id TEXT REFERENCES quests(id),
      source_type TEXT NOT NULL,
      source_id TEXT,
      amount INTEGER NOT NULL CHECK (amount > 0),
      local_date TEXT NOT NULL,
      awarded_at TEXT NOT NULL,
      idempotency_key TEXT NOT NULL UNIQUE
    )`,
    `CREATE INDEX ix_xp_events_day ON xp_events(profile_id, local_date)`,
  ],
};
