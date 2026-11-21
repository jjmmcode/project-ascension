import type { Db, DataStatus } from '../types';
import { newId } from '../ids';
import { nowIso } from '@/lib/time';
import { profileInputSchema, type ProfileInput } from '@/features/profile/schema';

export interface Profile {
  id: string;
  displayName: string;
  heightCm: number | null;
  heightStatus: DataStatus;
  timezone: string;
  birthYear: number | null;
  onboardingCompletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Row {
  id: string;
  display_name: string;
  height_cm: number | null;
  height_status: DataStatus;
  timezone: string;
  birth_year: number | null;
  onboarding_completed_at: string | null;
  created_at: string;
  updated_at: string;
}

const map = (r: Row): Profile => ({
  id: r.id,
  displayName: r.display_name,
  heightCm: r.height_cm,
  heightStatus: r.height_status,
  timezone: r.timezone,
  birthYear: r.birth_year ?? null,
  onboardingCompletedAt: r.onboarding_completed_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const profilesRepo = {
  /** Uso personal: el perfil activo es el primero creado. El esquema ya admite varios. */
  async getActive(db: Db): Promise<Profile | null> {
    const row = await db.getFirstAsync<Row>('SELECT * FROM profiles ORDER BY created_at ASC LIMIT 1', []);
    return row ? map(row) : null;
  },

  async getById(db: Db, id: string): Promise<Profile | null> {
    const row = await db.getFirstAsync<Row>('SELECT * FROM profiles WHERE id = ?', [id]);
    return row ? map(row) : null;
  },

  async create(db: Db, input: ProfileInput): Promise<Profile> {
    const p = profileInputSchema.parse(input);
    const id = newId();
    const now = nowIso();
    await db.runAsync(
      `INSERT INTO profiles (id, display_name, height_cm, height_status, timezone, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, p.displayName, p.heightCm, p.heightStatus, p.timezone, now, now],
    );
    return (await this.getById(db, id))!;
  },

  async update(db: Db, id: string, input: ProfileInput): Promise<Profile> {
    const p = profileInputSchema.parse(input);
    const res = await db.runAsync(
      `UPDATE profiles SET display_name = ?, height_cm = ?, height_status = ?, timezone = ?, updated_at = ?
       WHERE id = ?`,
      [p.displayName, p.heightCm, p.heightStatus, p.timezone, nowIso(), id],
    );
    if (res.changes !== 1) throw new Error(`Perfil no encontrado: ${id}`);
    return (await this.getById(db, id))!;
  },

  /** Año de nacimiento (dato confirmado por el usuario). */
  async setBirthYear(db: Db, id: string, year: number): Promise<void> {
    if (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear()) throw new Error('Año de nacimiento no válido');
    await db.runAsync('UPDATE profiles SET birth_year = ?, updated_at = ? WHERE id = ?', [year, nowIso(), id]);
  },

  async completeOnboarding(db: Db, id: string): Promise<void> {
    const now = nowIso();
    await db.runAsync('UPDATE profiles SET onboarding_completed_at = ?, updated_at = ? WHERE id = ?', [now, now, id]);
  },
};
