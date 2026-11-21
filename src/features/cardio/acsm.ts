/**
 * Gasto en caminadora con las ecuaciones metabólicas del ACSM (Guidelines for Exercise Testing and Prescription):
 *   Caminar: VO2 = 0,1·S + 1,8·S·G + 3,5   (más precisa entre 50 y 100 m/min ≈ 3–6 km/h)
 *   Correr:  VO2 = 0,2·S + 0,9·S·G + 3,5   (más precisa sobre 134 m/min ≈ 8 km/h, o desde 4,8 km/h si de verdad trotas)
 * S en m/min, G = inclinación en fracción (8 % = 0,08). VO2 en mL/kg/min.
 * Kcal netas = (VO2 − 3,5) · kg · min / 1000 · 5  (≈ 5 kcal por litro de O2; se descuenta el reposo, igual que en pesas).
 * Asume que no te agarras de las barras: agarrarse hace que sobreestime.
 */
export type CardioMode = 'walk' | 'run';

export const MIN_SPEED_KMH = 1;
export const MAX_SPEED_KMH = 25;
export const MAX_INCLINE_PCT = 30;
export const MAX_MINUTES = 300;

/** Modo sugerido por la velocidad: hasta 6,5 km/h se camina; desde 8 km/h se corre; entre medio, caminar. */
export function suggestedMode(speedKmh: number): CardioMode {
  return speedKmh >= 8 ? 'run' : 'walk';
}

export function vo2(mode: CardioMode, speedKmh: number, inclinePct: number): number {
  const s = (speedKmh * 1000) / 60;
  const g = Math.max(0, inclinePct) / 100;
  return mode === 'walk' ? 0.1 * s + 1.8 * s * g + 3.5 : 0.2 * s + 0.9 * s * g + 3.5;
}

/** METs brutos (VO2 / 3,5). */
export const mets = (mode: CardioMode, speedKmh: number, inclinePct: number) => vo2(mode, speedKmh, inclinePct) / 3.5;

export function netKcal(args: { mode: CardioMode; speedKmh: number; inclinePct: number; minutes: number; weightKg: number }): number {
  const v = vo2(args.mode, args.speedKmh, args.inclinePct);
  return Math.max(0, ((v - 3.5) * args.weightKg * args.minutes) / 1000) * 5;
}

/** ¿Está la velocidad fuera del rango donde la ecuación es más precisa? (para avisar, no para bloquear) */
export function outsideValidRange(mode: CardioMode, speedKmh: number): boolean {
  const mmin = (speedKmh * 1000) / 60;
  return mode === 'walk' ? mmin < 50 || mmin > 100 : mmin < 80;
}

export function distanceKm(speedKmh: number, minutes: number): number {
  return (speedKmh * minutes) / 60;
}
