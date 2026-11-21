/**
 * Gasto energético estimado de una sesión de pesas (lógica pura).
 *
 * Fórmula del Compendio de Actividad Física 2024 (Herrmann et al., J Sport Health Sci 2024):
 *   kcal brutas = MET × 3,5 × kg / 200 × minutos
 * Se muestran kcal NETAS (MET − 1): se resta el gasto en reposo, que Fitia y el TDEE ya cuentan.
 *
 * MET según la sesión:
 *   3,5 — 02054 «varios ejercicios, 8–15 repeticiones con cargas variadas» (la sesión típica).
 *   5,0 — 02052 «sentadilla, peso muerto»: mayoría de series en compuestos de pierna.
 *   6,0 — 02050 «culturismo, esfuerzo vigoroso»: sesión muy densa (poco descanso).
 *
 * Validación: un estudio con calorimetría (7 ejercicios, 2–3 series de 8–12 reps, una serie cada 2 min)
 * midió 167,7 ± 51,6 kcal netas en hombres; esta fórmula da ~165 kcal para 84 kg y 45 min.
 * Sin pulsómetro el error es grande: se muestra un rango de ±20 %.
 */
import type { MuscleGroup } from '@/features/exercises/library';
import { effectiveLoadKg, type LoadMode } from './load';

export interface EnergySet {
  exerciseId: string;
  completed: boolean;
  primary: MuscleGroup[];
}

export interface EnergyInput {
  startedAt: string;
  finishedAt: string;
  bodyweightKg: number;
  sets: EnergySet[];
}

export interface EnergyEstimate {
  kcal: number;
  low: number;
  high: number;
  met: number;
  metLabel: string;
  /** Minutos usados en el cálculo (la duración, con tope si se olvidó terminar la sesión). */
  minutes: number;
  /** true si la duración real superaba el tope y se recortó. */
  capped: boolean;
}

/** Aislamientos de pierna que no cuentan como «compuesto pesado». */
const LEG_ISOLATION = new Set(['ek-0142', 'ek-0117', 'ek-9305']);
const LEG_COMPOUND_MUSCLES: MuscleGroup[] = ['quads', 'hamstrings', 'glutes'];

/** Una serie + descanso rara vez supera 4 min; con más, probablemente la sesión quedó abierta. */
export const MAX_MINUTES_PER_SET = 4;
const EXTRA_MINUTES = 10; // calentamiento y cambios de máquina
/**
 * ≥0,6 series/min (serie + descanso ≤ ~100 s) = sesión vigorosa. Una serie cada 2 min (0,5/min) es justo el
 * protocolo del estudio de validación, que encaja con 3,5 MET.
 */
export const DENSE_SETS_PER_MIN = 0.6;
export const RANGE = 0.2;

const round5 = (n: number) => Math.round(n / 5) * 5;

export function chooseMet(sets: EnergySet[], minutes: number): { met: number; label: string } {
  const done = sets.filter((s) => s.completed);
  if (done.length === 0 || minutes <= 0) return { met: 3.5, label: 'Pesas, varios ejercicios (8–15 reps)' };
  if (done.length / minutes >= DENSE_SETS_PER_MIN) return { met: 6.0, label: 'Pesas, esfuerzo vigoroso (poco descanso)' };
  const heavyLegs = done.filter(
    (s) => !LEG_ISOLATION.has(s.exerciseId) && s.primary.some((m) => LEG_COMPOUND_MUSCLES.includes(m)),
  ).length;
  if (heavyLegs / done.length >= 0.5) return { met: 5.0, label: 'Pesas, compuestos de pierna' };
  return { met: 3.5, label: 'Pesas, varios ejercicios (8–15 reps)' };
}

export function estimateWorkoutEnergy(input: EnergyInput): EnergyEstimate | null {
  const done = input.sets.filter((s) => s.completed).length;
  const raw = (new Date(input.finishedAt).getTime() - new Date(input.startedAt).getTime()) / 60_000;
  if (!(raw > 0) || done === 0 || !(input.bodyweightKg > 0)) return null;
  const cap = done * MAX_MINUTES_PER_SET + EXTRA_MINUTES;
  const minutes = Math.min(raw, cap);
  const { met, label } = chooseMet(input.sets, minutes);
  const net = ((met - 1) * 3.5 * input.bodyweightKg) / 200 * minutes;
  return {
    kcal: round5(net),
    low: round5(net * (1 - RANGE)),
    high: round5(net * (1 + RANGE)),
    met,
    metLabel: label,
    minutes: Math.round(minutes),
    capped: raw > cap,
  };
}

/** Volumen total (kg × repeticiones) de las series hechas; las series por tiempo no suman. */
export function volumeLoadKg(
  sets: Array<{
    completed: boolean;
    repetitions: number | null;
    loadMode: LoadMode;
    weightKg: number | null;
    assistanceKg: number | null;
    bodyweightKg: number | null;
  }>,
): number {
  let total = 0;
  for (const s of sets) {
    if (!s.completed || !s.repetitions) continue;
    const load = effectiveLoadKg(s.loadMode, s);
    if (load != null && load > 0) total += load * s.repetitions;
  }
  return Math.round(total);
}
