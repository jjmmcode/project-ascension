/// <reference types="node" />
import { DatabaseSync } from 'node:sqlite';
import type { Db, SqlValue } from '@/database/types';

/**
 * Implementación de `Db` sobre el SQLite embebido de Node (≥ 22.13).
 * Ejecuta exactamente el mismo SQL que expo-sqlite en el teléfono.
 */
export function createTestDb(): Db & { close(): void; raw: DatabaseSync } {
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys = ON;');
  const plain = <T>(row: unknown): T => (row ? ({ ...(row as object) } as T) : (row as T));

  return {
    raw,
    close: () => raw.close(),
    async execAsync(sql: string) {
      raw.exec(sql);
    },
    async runAsync(sql: string, params: SqlValue[]) {
      const r = raw.prepare(sql).run(...params);
      return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) };
    },
    async getFirstAsync<T>(sql: string, params: SqlValue[]) {
      const row = raw.prepare(sql).get(...params);
      return row === undefined ? null : plain<T>(row);
    },
    async getAllAsync<T>(sql: string, params: SqlValue[]) {
      return raw.prepare(sql).all(...params).map((r) => plain<T>(r));
    },
    async withTransactionAsync(task: () => Promise<void>) {
      raw.exec('BEGIN');
      try {
        await task();
        raw.exec('COMMIT');
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      }
    },
  };
}
