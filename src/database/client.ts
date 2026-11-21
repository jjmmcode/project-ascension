import type { SQLiteDatabase } from 'expo-sqlite';
import { migrate } from './migrate';

export const DATABASE_NAME = 'ascension.db';

/** Se ejecuta una vez al abrir la BD (prop `onInit` de SQLiteProvider). */
export async function initDatabase(db: SQLiteDatabase): Promise<void> {
  // foreign_keys debe activarse fuera de transacciones y en cada conexión.
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  await migrate(db);
}
