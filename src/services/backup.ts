/**
 * Copia de seguridad: toda la base local a un JSON y vuelta.
 * - Exporta todas las tablas (salvo las internas de SQLite y el registro de migraciones).
 * - Restaurar reemplaza los datos actuales dentro de una transacción: si algo falla, no cambia nada.
 * - Acepta copias de versiones anteriores del esquema (las columnas nuevas toman su valor por defecto);
 *   rechaza copias de una versión más nueva que la app.
 */
import { z } from 'zod';
import type { Db, SqlValue } from '@/database/types';
import { transaction } from '@/database/transaction';
import { MIGRATIONS } from '@/database/migrations';

export const BACKUP_APP = 'project-ascension';
export const BACKUP_FORMAT = 1;
/** Ajuste con la fecha de la última exportación. */
export const LAST_BACKUP_KEY = 'backup.lastExport';

/** Orden de inserción (padres antes que hijos); se borra en orden inverso. */
const ORDER = [
  'profiles',
  'settings',
  'goals',
  'body_metrics',
  'progress_photos',
  'exercises',
  'workout_templates',
  'workout_template_exercises',
  'workout_schedule',
  'workouts',
  'workout_sets',
  'cardio_sessions',
  'foods',
  'food_logs',
  'water_logs',
  'habits',
  'habit_logs',
  'quests',
  'quest_progress',
  'xp_events',
  'xp_penalties',
];

const backupSchema = z.object({
  app: z.literal(BACKUP_APP),
  format: z.literal(BACKUP_FORMAT),
  schemaVersion: z.number().int().min(1),
  exportedAt: z.string(),
  tables: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))),
});
export type Backup = z.infer<typeof backupSchema>;

async function userTables(db: Db): Promise<string[]> {
  const rows = await db.getAllAsync<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != 'schema_migrations'`,
    [],
  );
  const names = rows.map((r) => r.name);
  const known = ORDER.filter((t) => names.includes(t));
  return [...known, ...names.filter((n) => !ORDER.includes(n)).sort()];
}

async function columns(db: Db, table: string): Promise<string[]> {
  const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`, []);
  return rows.map((r) => r.name);
}

export async function exportBackup(db: Db, now: Date = new Date()): Promise<Backup> {
  const tables: Backup['tables'] = {};
  for (const t of await userTables(db)) tables[t] = await db.getAllAsync<Record<string, unknown>>(`SELECT * FROM ${t}`, []);
  return {
    app: BACKUP_APP,
    format: BACKUP_FORMAT,
    schemaVersion: MIGRATIONS[MIGRATIONS.length - 1]!.version,
    exportedAt: now.toISOString(),
    tables,
  };
}

export interface BackupSummary {
  exportedAt: string;
  schemaVersion: number;
  workouts: number;
  sets: number;
  bodyMetrics: number;
  xpEvents: number;
}

export class BackupError extends Error {}

/** Valida el texto de una copia y devuelve un resumen (no toca la base). */
export function parseBackup(text: string): { backup: Backup; summary: BackupSummary } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError('El archivo no es un JSON válido.');
  }
  const parsed = backupSchema.safeParse(raw);
  if (!parsed.success) throw new BackupError('El archivo no es una copia de seguridad de Project Ascension.');
  const backup = parsed.data;
  const current = MIGRATIONS[MIGRATIONS.length - 1]!.version;
  if (backup.schemaVersion > current) {
    throw new BackupError('La copia viene de una versión más nueva de la app. Actualiza la app antes de restaurarla.');
  }
  const n = (t: string) => backup.tables[t]?.length ?? 0;
  return {
    backup,
    summary: {
      exportedAt: backup.exportedAt,
      schemaVersion: backup.schemaVersion,
      workouts: n('workouts'),
      sets: n('workout_sets'),
      bodyMetrics: n('body_metrics'),
      xpEvents: n('xp_events'),
    },
  };
}

const toSql = (v: unknown): SqlValue => {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' || typeof v === 'string') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  return JSON.stringify(v);
};

/** Reemplaza todos los datos por los de la copia (todo o nada). */
export async function restoreBackup(db: Db, backup: Backup): Promise<Record<string, number>> {
  const tables = await userTables(db);
  const counts: Record<string, number> = {};
  await transaction(db, async () => {
    for (const t of [...tables].reverse()) await db.runAsync(`DELETE FROM ${t}`, []);
    for (const t of tables) {
      const rows = backup.tables[t];
      if (!rows?.length) continue;
      const cols = await columns(db, t);
      for (const row of rows) {
        const keys = Object.keys(row).filter((k) => cols.includes(k));
        if (keys.length === 0) continue;
        await db.runAsync(
          `INSERT INTO ${t} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
          keys.map((k) => toSql(row[k])),
        );
      }
      counts[t] = rows.length;
    }
  });
  return counts;
}

export const backupFileName = (now: Date = new Date()) => `ascension-copia-${now.toISOString().slice(0, 10)}.json`;
