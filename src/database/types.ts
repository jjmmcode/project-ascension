/**
 * Subconjunto de la API de expo-sqlite que usa la app.
 * `SQLiteDatabase` de expo-sqlite lo cumple estructuralmente, y en las pruebas
 * se implementa sobre `node:sqlite`: el SQL que se prueba es el mismo que corre en el teléfono.
 */
export type SqlValue = string | number | null;

export interface RunResult {
  changes: number;
  lastInsertRowId: number;
}

export interface Db {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params: SqlValue[]): Promise<RunResult>;
  getFirstAsync<T>(sql: string, params: SqlValue[]): Promise<T | null>;
  getAllAsync<T>(sql: string, params: SqlValue[]): Promise<T[]>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

/** Estado de un dato importado o registrado (sección 11 del prompt). */
export type DataStatus = 'confirmed' | 'historical' | 'estimated';
