/**
 * @jest-environment node
 */
import { z } from 'zod';
import { createTestDb } from './helpers/nodeDb';
import { bodyMetricsRepo, getSchemaVersion, goalsRepo, migrate, profilesRepo, settingsRepo, transaction } from '@/database';
import { MIGRATIONS, type Migration } from '@/database/migrations';
import { completeOnboarding, getPrimaryGoal } from '@/services/onboarding';

let db: ReturnType<typeof createTestDb>;

beforeEach(async () => {
  db = createTestDb();
  await migrate(db);
});
afterEach(() => db.close());

const tables = async () =>
  (await db.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", [])).map(
    (r) => r.name,
  );

describe('migraciones', () => {
  it('aplica v1 y crea todas las tablas', async () => {
    expect(await getSchemaVersion(db)).toBe(MIGRATIONS.length);
    const t = await tables();
    for (const name of [
      'profiles', 'settings', 'goals', 'body_metrics', 'progress_photos', 'exercises', 'workout_templates',
      'workout_template_exercises', 'workout_schedule', 'workouts', 'workout_sets', 'foods', 'food_logs',
      'water_logs', 'habits', 'habit_logs', 'quests', 'quest_progress', 'xp_events', 'schema_migrations',
    ]) {
      expect(t).toContain(name);
    }
  });

  it('es idempotente: ejecutar dos veces no falla ni duplica', async () => {
    await migrate(db);
    const rows = await db.getAllAsync('SELECT * FROM schema_migrations', []);
    expect(rows).toHaveLength(MIGRATIONS.length);
  });

  it('una migración fallida se revierte completa', async () => {
    const broken: Migration = {
      version: MIGRATIONS.length + 1,
      name: 'broken',
      statements: ['CREATE TABLE temp_ok (id TEXT)', 'THIS IS NOT SQL'],
    };
    await expect(migrate(db, [...MIGRATIONS, broken])).rejects.toThrow();
    expect(await getSchemaVersion(db)).toBe(MIGRATIONS.length);
    expect(await tables()).not.toContain('temp_ok');
  });

  it('rechaza migraciones fuera de orden', async () => {
    const skip: Migration = { version: MIGRATIONS.length + 2, name: 'skip', statements: [] };
    await expect(migrate(db, [...MIGRATIONS, skip])).rejects.toThrow(/fuera de orden/);
  });

  it('v2 y v3 se aplican sobre una base v1 con datos sin perderlos', async () => {
    const old = createTestDb();
    await migrate(old, MIGRATIONS.slice(0, 1));
    const p = await profilesRepo.create(old, { displayName: 'Antes', heightCm: 180 });
    await old.runAsync(
      `INSERT INTO exercises (id, name, category, primary_muscle, equipment, exercise_type, created_at, updated_at)
       VALUES ('x', 'Curl', 'gym', 'biceps', 'barbell', 'reps', 'a', 'a')`,
      [],
    );
    await migrate(old);
    expect(await getSchemaVersion(old)).toBe(MIGRATIONS.length);
    expect((await profilesRepo.getById(old, p.id))?.displayName).toBe('Antes');
    const ex = await old.getFirstAsync<{ load_mode: string }>(`SELECT load_mode FROM exercises WHERE id = 'x'`, []);
    expect(ex?.load_mode).toBe('external');
    await expect(old.runAsync(`UPDATE exercises SET load_mode = 'magia' WHERE id = 'x'`, [])).rejects.toThrow(/CHECK/);
    old.close();
  });

  it('las restricciones CHECK impiden valores imposibles aunque se salte Zod', async () => {
    const p = await profilesRepo.create(db, { displayName: 'Test', heightCm: 180 });
    await expect(
      db.runAsync(
        `INSERT INTO water_logs (id, profile_id, consumed_at, local_date, quantity_ml, created_at)
         VALUES ('w1', ?, '2026-11-17T00:00:00Z', '2026-11-17', -250, '2026-11-17T00:00:00Z')`,
        [p.id],
      ),
    ).rejects.toThrow(/CHECK/);
  });

  it('xp_events.idempotency_key impide XP duplicada a nivel de BD', async () => {
    const p = await profilesRepo.create(db, { displayName: 'Test', heightCm: null });
    const insert = (id: string) =>
      db.runAsync(
        `INSERT OR IGNORE INTO xp_events (id, profile_id, source_type, amount, local_date, awarded_at, idempotency_key)
         VALUES (?, ?, 'workout', 100, '2026-11-17', '2026-11-17T20:00:00Z', 'workout:abc')`,
        [id, p.id],
      );
    expect((await insert('e1')).changes).toBe(1);
    expect((await insert('e2')).changes).toBe(0);
  });
});

describe('perfiles', () => {
  it('crea y persiste, recortando espacios', async () => {
    const p = await profilesRepo.create(db, { displayName: '  Ana  ', heightCm: 180 });
    expect(p.displayName).toBe('Ana');
    expect((await profilesRepo.getActive(db))?.id).toBe(p.id);
  });

  it('rechaza nombre vacío y altura imposible', async () => {
    await expect(profilesRepo.create(db, { displayName: '   ', heightCm: 180 })).rejects.toThrow();
    await expect(profilesRepo.create(db, { displayName: 'X', heightCm: 30 })).rejects.toThrow();
    expect(await profilesRepo.getActive(db)).toBeNull();
  });

  it('BD vacía: no hay perfil activo', async () => {
    expect(await profilesRepo.getActive(db)).toBeNull();
  });
});

describe('ajustes', () => {
  it('upsert validado por esquema', async () => {
    const p = await profilesRepo.create(db, { displayName: 'T', heightCm: null });
    const schema = z.number().int().min(250);
    await settingsRepo.set(db, p.id, 'water_goal', schema, 2500);
    await settingsRepo.set(db, p.id, 'water_goal', schema, 3000);
    expect(await settingsRepo.get(db, p.id, 'water_goal', schema)).toBe(3000);
    await expect(settingsRepo.set(db, p.id, 'water_goal', schema, -1)).rejects.toThrow();
    const count = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) n FROM settings', []);
    expect(count?.n).toBe(1);
  });
});

describe('mediciones corporales', () => {
  it('latest ordena por fecha de medición, no de carga', async () => {
    const p = await profilesRepo.create(db, { displayName: 'T', heightCm: null });
    await bodyMetricsRepo.create(db, p.id, { measuredAt: '2026-11-10T12:00:00.000Z', weightKg: 83, source: 'manual' });
    await bodyMetricsRepo.create(db, p.id, {
      measuredAt: '2026-05-01T12:00:00.000Z', weightKg: 90, source: 'inbody', dataStatus: 'historical',
    });
    const latest = await bodyMetricsRepo.latest(db, p.id);
    expect(latest?.weightKg).toBe(83);
    expect(latest?.dataStatus).toBe('confirmed');
  });

  it('rechaza registros sin valores, fechas futuras y pesos imposibles', async () => {
    const p = await profilesRepo.create(db, { displayName: 'T', heightCm: null });
    const future = new Date(Date.now() + 86_400_000).toISOString();
    await expect(bodyMetricsRepo.create(db, p.id, { measuredAt: future, weightKg: 80, source: 'manual' })).rejects.toThrow();
    await expect(bodyMetricsRepo.create(db, p.id, { measuredAt: '2026-11-01T00:00:00.000Z', source: 'manual' })).rejects.toThrow();
    await expect(
      bodyMetricsRepo.create(db, p.id, { measuredAt: '2026-11-01T00:00:00.000Z', weightKg: 900, source: 'manual' }),
    ).rejects.toThrow();
    expect(await bodyMetricsRepo.list(db, p.id)).toHaveLength(0);
  });

  it('borrado lógico oculta el registro', async () => {
    const p = await profilesRepo.create(db, { displayName: 'T', heightCm: null });
    const m = await bodyMetricsRepo.create(db, p.id, { measuredAt: '2026-11-01T00:00:00.000Z', weightKg: 84, source: 'manual' });
    await bodyMetricsRepo.softDelete(db, m.id);
    expect(await bodyMetricsRepo.latest(db, p.id)).toBeNull();
  });
});

describe('objetivos', () => {
  it('un solo objetivo activo por tipo; el anterior queda en historial', async () => {
    const p = await profilesRepo.create(db, { displayName: 'T', heightCm: null });
    await goalsRepo.setActive(db, p.id, { goalType: 'calories', targetValue: 2000, startDate: '2026-11-01' });
    await goalsRepo.setActive(db, p.id, { goalType: 'calories', targetValue: 2200, startDate: '2026-11-17' });
    const active = await goalsRepo.listActive(db, p.id);
    expect(active.calories?.targetValue).toBe(2200);
    const hist = await goalsRepo.history(db, p.id, 'calories');
    expect(hist.map((g) => g.status)).toEqual(['archived', 'active']);
  });

  it('rechaza valores fuera de rango', async () => {
    const p = await profilesRepo.create(db, { displayName: 'T', heightCm: null });
    await expect(goalsRepo.setActive(db, p.id, { goalType: 'calories', targetValue: 300, startDate: '2026-11-01' })).rejects.toThrow();
    await expect(goalsRepo.setActive(db, p.id, { goalType: 'workouts_per_week', targetValue: 9, startDate: '2026-11-01' })).rejects.toThrow();
  });
});

describe('onboarding', () => {
  const base = {
    displayName: 'Test',
    heightCm: 180,
    currentWeightKg: 80,
    primaryGoal: 'recomposition' as const,
    caloriesGoal: 2000,
    proteinGoalG: 160,
    workoutsPerWeek: 4,
    birthYear: 1995,
  };

  it('crea perfil, objetivos, ajustes y la medición actual', async () => {
    const p = await completeOnboarding(db, base);
    expect(p.onboardingCompletedAt).not.toBeNull();
    expect(await getPrimaryGoal(db, p.id)).toBe('recomposition');

    const goals = await goalsRepo.listActive(db, p.id);
    expect(goals.calories?.targetValue).toBe(2000);
    expect(goals.protein_g?.targetValue).toBe(160);
    expect(goals.workouts_per_week?.targetValue).toBe(4);

    const metrics = await bodyMetricsRepo.list(db, p.id);
    expect(metrics.map((m) => m.dataStatus)).toEqual(['confirmed']);
    expect((await bodyMetricsRepo.latest(db, p.id))?.weightKg).toBe(80);
    expect(p.birthYear).toBe(1995);
  });

  it('sin peso: no crea mediciones', async () => {
    const p = await completeOnboarding(db, { ...base, currentWeightKg: null, caloriesGoal: null });
    expect(await bodyMetricsRepo.list(db, p.id)).toHaveLength(0);
    expect((await goalsRepo.listActive(db, p.id)).calories).toBeUndefined();
  });

  it('es atómico: un dato inválido no deja un perfil a medias', async () => {
    await expect(completeOnboarding(db, { ...base, currentWeightKg: 5 })).rejects.toThrow();
    expect(await profilesRepo.getActive(db)).toBeNull();
    const n = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) n FROM goals', []);
    expect(n?.n).toBe(0);
  });
});

describe('transacciones anidadas', () => {
  it('un fallo interno revierte solo el savepoint; uno externo revierte todo', async () => {
    await transaction(db, async () => {
      await profilesRepo.create(db, { displayName: 'Exterior', heightCm: null });
      await expect(
        transaction(db, async () => {
          await profilesRepo.create(db, { displayName: 'Interior', heightCm: null });
          throw new Error('falla interna');
        }),
      ).rejects.toThrow('falla interna');
    });
    const names = (await db.getAllAsync<{ display_name: string }>('SELECT display_name FROM profiles', [])).map((r) => r.display_name);
    expect(names).toEqual(['Exterior']);

    await expect(
      transaction(db, async () => {
        await profilesRepo.create(db, { displayName: 'Otro', heightCm: null });
        await transaction(db, async () => undefined);
        throw new Error('falla externa');
      }),
    ).rejects.toThrow('falla externa');
    expect(await db.getAllAsync('SELECT * FROM profiles', [])).toHaveLength(1);
  });
});
