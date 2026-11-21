/**
 * Estándares de fuerza (hombres) por ejercicio, como 1RM estimado / peso corporal.
 * Cinco umbrales: principiante, novato, intermedio, avanzado, élite → ranks D, C, B, A, S (por debajo: E).
 *
 * - `published`: tablas publicadas habituales (press de banca 0,5/0,75/1,25/1,75/2,0 × peso corporal, etc.).
 * - `approx`: estimaciones a partir de estándares de población (Strength Level / FitnessVolt) para ~84 kg;
 *   en ejercicios fuera de los básicos son modelos escalados, por eso la app los marca «aprox.».
 * - Mancuernas: por mano. Máquinas de placas, poleas y prensa: aproximados (varían entre gimnasios).
 * - Máquinas de palanca cargadas con discos: sin estándar (no comparables), solo cuentan para el progreso.
 * - Peso corporal / asistidas: se usa la carga efectiva (peso ± lastre/asistencia).
 * - Isométricos: segundos.
 */
export type StandardKind = 'published' | 'approx';

export interface LoadStandard {
  type: 'load';
  kind: StandardKind;
  /** 1RM / peso corporal para principiante, novato, intermedio, avanzado y élite. */
  ratios: [number, number, number, number, number];
}

export interface TimeStandard {
  type: 'time';
  kind: StandardKind;
  /** Segundos sostenidos para principiante … élite. */
  seconds: [number, number, number, number, number];
}

export type Standard = LoadStandard | TimeStandard;

const load = (kind: StandardKind, ...ratios: [number, number, number, number, number]): LoadStandard => ({
  type: 'load',
  kind,
  ratios,
});
const time = (...seconds: [number, number, number, number, number]): TimeStandard => ({ type: 'time', kind: 'approx', seconds });

/** Clave: id de la biblioteca ("ek-0042"). */
export const STANDARDS: Record<string, Standard> = {
  // Pecho
  'ek-0042': load('published', 0.5, 0.75, 1.25, 1.75, 2.0), // press de banca con barra
  'ek-0061': load('approx', 0.13, 0.22, 0.33, 0.46, 0.6), // press inclinado con mancuernas (por mano)
  'ek-0054': load('approx', 0.9, 1.23, 1.53, 1.9, 2.27), // fondos (carga efectiva): 0/7/16/27/38 reps
  // Tríceps
  'ek-0206': load('approx', 0.23, 0.36, 0.54, 0.74, 0.98), // extensión en polea
  'ek-0194': load('approx', 0.12, 0.2, 0.32, 0.46, 0.62), // extensión sobre la cabeza, mancuerna a dos manos
  // Espalda
  'ek-0087': load('approx', 0.8, 1.0, 1.33, 1.6, 1.9), // dominadas (carga efectiva): asistida/1/10/18/27 reps
  'ek-9087': load('approx', 0.8, 1.0, 1.33, 1.6, 1.9), // dominadas asistidas (misma escala, carga efectiva)
  'ek-0024': load('approx', 0.19, 0.32, 0.49, 0.69, 0.92), // remo con mancuerna (por mano)
  'ek-0025': load('approx', 0.4, 0.6, 0.85, 1.15, 1.5), // remo sentado en polea
  'ek-0097': load('approx', 0.39, 0.57, 0.81, 1.1, 1.4), // jalón al pecho
  'ek-0005': load('approx', 0.27, 0.45, 0.68, 0.95, 1.25), // encogimientos con mancuernas (por mano)
  // Bíceps
  'ek-0211': load('approx', 0.25, 0.38, 0.55, 0.75, 0.98), // curl con barra
  'ek-0239': load('approx', 0.2, 0.32, 0.47, 0.65, 0.85), // curl predicador
  'ek-0253': load('approx', 0.17, 0.3, 0.47, 0.68, 0.9), // curl en máquina (placas)
  'ek-0223': load('approx', 0.1, 0.16, 0.24, 0.34, 0.45), // curl alterno con mancuerna (por mano)
  // Hombros
  'ek-0004': load('approx', 0.35, 0.55, 0.8, 1.05, 1.35), // press militar con barra
  'ek-0018': load('approx', 0.06, 0.11, 0.17, 0.25, 0.33), // elevaciones laterales (por mano)
  'ek-0035': load('approx', 0.05, 0.09, 0.14, 0.2, 0.27), // posteriores en polea
  'ek-9308': load('approx', 0.07, 0.13, 0.2, 0.3, 0.39), // elevación frontal con disco
  // Antebrazo
  'ek-0257': load('approx', 0.08, 0.13, 0.2, 0.28, 0.37), // curl inverso (por mano)
  'ek-9306': load('approx', 0.08, 0.14, 0.22, 0.32, 0.42), // curl de muñeca (por mano)
  // Pierna
  'ek-0127': load('approx', 0.9, 1.55, 2.45, 3.5, 4.7), // prensa
  'ek-0118': load('approx', 0.6, 0.9, 1.3, 1.75, 2.2), // peso muerto rumano
  'ek-0121': load('approx', 0.1, 0.2, 0.32, 0.46, 0.6), // zancadas con mancuernas (por mano)
  'ek-0142': load('approx', 0.4, 0.65, 1.0, 1.4, 1.9), // extensión de cuádriceps
  'ek-0117': load('approx', 0.3, 0.5, 0.75, 1.05, 1.4), // curl femoral tumbado
  'ek-0282': load('approx', 0.55, 1.0, 1.6, 2.4, 3.25), // gemelos de pie en máquina
  // Core (isométricos)
  'ek-9304': time(20, 45, 90, 150, 240), // plancha frontal
  'ek-0113': time(15, 30, 60, 90, 150), // plancha lateral (por lado)
};

/** Máquinas de palanca cargadas con discos: no comparables con tablas. */
export const NO_STANDARD_IDS = new Set(['ek-9307']);

export function standardFor(libraryId: string): Standard | null {
  if (NO_STANDARD_IDS.has(libraryId)) return null;
  return STANDARDS[libraryId] ?? null;
}
