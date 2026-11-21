import type { z } from 'zod';
import type { Db } from '../types';
import { newId } from '../ids';
import { nowIso } from '@/lib/time';

/**
 * Ajustes clave/valor por perfil. El valor se guarda como JSON y se valida
 * con el esquema Zod que entrega quien llama, tanto al escribir como al leer.
 */
export const settingsRepo = {
  async get<S extends z.ZodType>(db: Db, profileId: string, key: string, schema: S): Promise<z.infer<S> | null> {
    const row = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM settings WHERE profile_id = ? AND key = ?',
      [profileId, key],
    );
    if (!row) return null;
    const parsed = schema.safeParse(JSON.parse(row.value));
    return parsed.success ? parsed.data : null;
  },

  async set<S extends z.ZodType>(db: Db, profileId: string, key: string, schema: S, value: z.input<S>): Promise<void> {
    const valid = schema.parse(value);
    await db.runAsync(
      `INSERT INTO settings (id, profile_id, key, value, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (profile_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [newId(), profileId, key, JSON.stringify(valid), nowIso()],
    );
  },
};
