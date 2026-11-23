/**
 * Curva de progresión RPG (lógica pura, sin dependencias de UI ni BD).
 *
 * XP necesaria para pasar del nivel L al L+1 (curva aprobada el 23-11-2026):
 *     xpToNext(L) = redondeo a decenas de 45 · L^1.1
 *
 *   L1→2: 50 · L5→6: 260 · L10→11: 570 · L30→31: 1.900 · L60→61: 4.070 · L99→100: 7.050
 *
 * Calibrada con una semana realista (5 sesiones + 2 de caminadora + misión ≈ 650 XP):
 * nivel 10 ≈ 1 mes, 30 ≈ 10 meses, 45 ≈ 2 años, 60 ≈ 3,5 años, 100 ≈ 10 años.
 * La curva anterior (100 · L^1.5) dejaba el nivel 60 a 32 años y el 100 a 117.
 * El nivel mide constancia; la fuerza la miden los exámenes (exams.ts). Los topes diarios impiden "farmear" XP.
 */

/** Rank de un músculo (estándares de fuerza: 5 umbrales → E…S). */
export type MuscleRankLetter = 'E' | 'D' | 'C' | 'B' | 'A' | 'S';
/** Rango general del personaje (nivel + examen de fuerza), hasta SSS+. */
export type Rank = MuscleRankLetter | 'SS' | 'SSS' | 'SSS+';

export const MAX_LEVEL = 100;

/**
 * Nivel mínimo para cada rango general (acordado el 20-11-2026). Además del nivel, cada rango
 * exige aprobar un examen de fuerza (ver features/progression/exams.ts).
 */
export const RANK_THRESHOLDS: ReadonlyArray<{ rank: Rank; minLevel: number }> = [
  { rank: 'E', minLevel: 1 },
  { rank: 'D', minLevel: 10 },
  { rank: 'C', minLevel: 20 },
  { rank: 'B', minLevel: 30 },
  { rank: 'A', minLevel: 45 },
  { rank: 'S', minLevel: 60 },
  { rank: 'SS', minLevel: 75 },
  { rank: 'SSS', minLevel: 90 },
  { rank: 'SSS+', minLevel: 100 },
];

export const GENERAL_RANKS: Rank[] = RANK_THRESHOLDS.map((t) => t.rank);
export const minLevelFor = (rank: Rank): number => RANK_THRESHOLDS.find((t) => t.rank === rank)!.minLevel;

export function xpToNext(level: number): number {
  if (!Number.isInteger(level) || level < 1) {
    throw new RangeError(`Nivel inválido: ${level}`);
  }
  if (level >= MAX_LEVEL) return 0;
  return Math.round((45 * Math.pow(level, 1.1)) / 10) * 10;
}

/** XP total acumulada necesaria para *alcanzar* un nivel (nivel 1 = 0). */
export function totalXpForLevel(level: number): number {
  let total = 0;
  for (let l = 1; l < Math.min(level, MAX_LEVEL); l++) total += xpToNext(l);
  return total;
}

/** Rango máximo que permite el nivel (sin contar el examen de fuerza). */
export function rankForLevel(level: number): Rank {
  let current: Rank = 'E';
  for (const t of RANK_THRESHOLDS) if (level >= t.minLevel) current = t.rank;
  return current;
}

export interface LevelState {
  level: number;
  rank: Rank;
  totalXp: number;
  /** XP acumulada dentro del nivel actual. */
  xpIntoLevel: number;
  /** XP total requerida para completar el nivel actual (0 en nivel máximo). */
  xpForNext: number;
  /** 0..1 */
  progress: number;
}

/** Deriva nivel/rango a partir de la XP total. La XP nunca se almacena como nivel. */
export function levelFromXp(totalXp: number): LevelState {
  if (!Number.isFinite(totalXp) || totalXp < 0) {
    throw new RangeError(`XP inválida: ${totalXp}`);
  }
  const xp = Math.floor(totalXp);
  let level = 1;
  let remaining = xp;
  while (level < MAX_LEVEL && remaining >= xpToNext(level)) {
    remaining -= xpToNext(level);
    level++;
  }
  const xpForNext = xpToNext(level);
  return {
    level,
    rank: rankForLevel(level),
    totalXp: xp,
    xpIntoLevel: level >= MAX_LEVEL ? 0 : remaining,
    xpForNext,
    progress: xpForNext === 0 ? 1 : remaining / xpForNext,
  };
}
