import { z } from 'zod';
import type { Db } from '@/database/types';
import { settingsRepo } from '@/database/repositories/settings';
import { DEFAULT_SOUND_CONFIG, setSoundConfig, type SoundConfig } from './sound';

const KEY = 'sound.config';
const schema = z.object({ enabled: z.boolean(), volume: z.number().min(0).max(1), onlyBig: z.boolean() });

export async function loadSoundConfig(db: Db, profileId: string): Promise<SoundConfig> {
  const c = (await settingsRepo.get(db, profileId, KEY, schema)) ?? DEFAULT_SOUND_CONFIG;
  setSoundConfig(c);
  return c;
}

export async function saveSoundConfig(db: Db, profileId: string, c: SoundConfig): Promise<void> {
  await settingsRepo.set(db, profileId, KEY, schema, c);
  setSoundConfig(c);
}
