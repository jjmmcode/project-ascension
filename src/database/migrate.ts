import type { Db } from './types';
import { transaction } from './transaction';
import { MIGRATIONS, type Migration } from './migrations';

const BOOKKEEPING = `CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
)`;

export async function getSchemaVersion(db: Db): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
  return row?.user_version ?? 0;
}

/**
 * Aplica en orden las migraciones pendientes. Cada una corre en su propia
 * transacción: si una sentencia falla, esa versión se revierte completa y la
 * base queda en la versión anterior (nunca a medias).
 */
export async function migrate(db: Db, migrations: Migration[] = MIGRATIONS): Promise<number> {
  assertSequential(migrations);
  await db.execAsync(BOOKKEEPING);
  let current = await getSchemaVersion(db);

  for (const m of migrations) {
    if (m.version <= current) continue;
    await transaction(db, async () => {
      for (const sql of m.statements) await db.execAsync(sql);
      await db.runAsync('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)', [
        m.version,
        m.name,
        new Date().toISOString(),
      ]);
      // PRAGMA no admite parámetros; version es un entero validado.
      await db.execAsync(`PRAGMA user_version = ${m.version}`);
    });
    current = m.version;
  }
  return current;
}

function assertSequential(migrations: Migration[]) {
  migrations.forEach((m, i) => {
    if (!Number.isInteger(m.version) || m.version !== i + 1) {
      throw new Error(`Migración fuera de orden: posición ${i} tiene versión ${m.version}`);
    }
  });
}
