/**
 * Efectos de sonido (expo-audio). Sonidos CC0 de Kenney (Interface Sounds y Music Jingles).
 * - Suenan mezclados con tu música (`mixWithOthers`): Spotify no se pausa.
 * - Los momentos grandes bajan un instante el volumen de la música (`duckOthers`) y luego lo devuelven.
 * - Respeta el modo silencio/vibración del teléfono (`playsInSilentMode: false`).
 * - Activados por defecto; se apagan o se dejan solo para momentos importantes en Ajustes.
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

export type SoundName =
  | 'set_done'
  | 'session_done'
  | 'ding'
  | 'recover'
  | 'penance'
  | 'crack_light'
  | 'crack_heavy'
  | 'repair'
  | 'level_up'
  | 'rank_up'
  | 'impact'
  | 'mission'
  | 'timer_done';

const SOURCES: Record<SoundName, number> = {
  set_done: require('../../../assets/sounds/set_done.mp3'),
  session_done: require('../../../assets/sounds/session_done.mp3'),
  ding: require('../../../assets/sounds/ding.mp3'),
  recover: require('../../../assets/sounds/recover.mp3'),
  penance: require('../../../assets/sounds/penance.mp3'),
  crack_light: require('../../../assets/sounds/crack_light.mp3'),
  crack_heavy: require('../../../assets/sounds/crack_heavy.mp3'),
  repair: require('../../../assets/sounds/repair.mp3'),
  level_up: require('../../../assets/sounds/level_up.mp3'),
  rank_up: require('../../../assets/sounds/rank_up.mp3'),
  impact: require('../../../assets/sounds/impact.mp3'),
  mission: require('../../../assets/sounds/mission.mp3'),
  timer_done: require('../../../assets/sounds/timer_done.mp3'),
};

/** Momentos grandes: bajan un instante la música. El resto son «menores» (se pueden silenciar aparte). */
const BIG: Partial<Record<SoundName, number>> = { level_up: 2000, rank_up: 2200, impact: 1200, crack_heavy: 1200, repair: 1800 };

export interface SoundConfig {
  enabled: boolean;
  /** 0–1 */
  volume: number;
  onlyBig: boolean;
}
export const DEFAULT_SOUND_CONFIG: SoundConfig = { enabled: true, volume: 0.8, onlyBig: false };

let config: SoundConfig = DEFAULT_SOUND_CONFIG;
const players = new Map<SoundName, AudioPlayer>();
let modeReady = false;
let duckTimer: ReturnType<typeof setTimeout> | null = null;

export function setSoundConfig(c: SoundConfig): void {
  config = c;
}
export const soundConfig = () => config;

async function mode(interruption: 'mixWithOthers' | 'duckOthers') {
  await setAudioModeAsync({ playsInSilentMode: false, interruptionMode: interruption, shouldPlayInBackground: false });
}

function player(name: SoundName): AudioPlayer {
  let p = players.get(name);
  if (!p) {
    p = createAudioPlayer(SOURCES[name]);
    players.set(name, p);
  }
  return p;
}

/** Reproduce un sonido. Nunca lanza: un fallo de audio no debe romper la app. */
export async function playSound(name: SoundName): Promise<void> {
  try {
    const big = BIG[name];
    if (!config.enabled || (config.onlyBig && !big)) return;
    if (!modeReady) {
      await mode('mixWithOthers');
      modeReady = true;
    }
    if (big) {
      await mode('duckOthers');
      if (duckTimer) clearTimeout(duckTimer);
      duckTimer = setTimeout(() => void mode('mixWithOthers').catch(() => undefined), big);
    }
    const p = player(name);
    p.volume = config.volume;
    await p.seekTo(0);
    p.play();
  } catch {
    // sin sonido
  }
}

/** Precarga los sonidos para que el primero no llegue tarde. */
export function preloadSounds(): void {
  try {
    for (const n of Object.keys(SOURCES) as SoundName[]) player(n);
  } catch {
    // sin sonido
  }
}
