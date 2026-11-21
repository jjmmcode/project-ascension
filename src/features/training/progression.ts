/**
 * Sugerencia de progresión (doble progresión).
 * - Se trabaja dentro de un rango de repeticiones («10–12»; un número fijo «12» es su propio tope).
 * - Si en la última sesión TODAS las series llegaron al tope con el mismo peso → subir carga
 *   (ACSM: +2–10 % cuando superas el objetivo); se redondea al salto mínimo del equipamiento.
 * - Si no, mismo peso y buscar el tope en todas las series (subir repeticiones también progresa:
 *   Plotkin et al. 2022).
 * Asistidas: progresar = quitar asistencia. Peso corporal: añadir lastre.
 */
import type { LoadMode } from './load';

export interface LastSet {
  repetitions: number | null;
  weightKg: number | null;
  assistanceKg: number | null;
}

export type Suggestion =
  | { kind: 'increase'; fromKg: number; toKg: number; reps: number; field: 'weight' | 'assistance' }
  | { kind: 'reps'; kg: number | null; goalReps: number; field: 'weight' | 'assistance' };

/** "10–12" → [10, 12]; "12 por pierna" → [12, 12]; "30–45 s" → null (tiempo). */
export function repRange(target: string): [number, number] | null {
  if (/\bs\b|seg/i.test(target)) return null;
  const nums = target.match(/\d+/g)?.map(Number) ?? [];
  if (nums.length === 0) return null;
  const lo = nums[0]!;
  const hi = nums.length > 1 && nums[1]! >= lo ? nums[1]! : lo;
  return [lo, hi];
}

/** Salto mínimo razonable según el equipamiento. */
export function loadStep(equipment: readonly string[], plateBothSides: boolean): number {
  if (plateBothSides) return 5; // 2,5 kg por lado
  if (equipment.includes('dumbbell')) return 2;
  return 2.5;
}

const roundTo = (v: number, step: number) => Math.round(v / step) * step;

export function suggestProgression(input: {
  target: string;
  loadMode: LoadMode;
  lastSets: LastSet[];
  step: number;
}): Suggestion | null {
  const range = repRange(input.target);
  if (!range || input.lastSets.length === 0) return null;
  const [lo, hi] = range;
  const assisted = input.loadMode === 'assisted';
  const field = assisted ? 'assistance' : 'weight';
  const loads = input.lastSets.map((s) => (assisted ? s.assistanceKg : s.weightKg) ?? 0);
  const same = loads.every((l) => Math.abs(l - loads[0]!) < 0.01);
  const allTop = input.lastSets.every((s) => (s.repetitions ?? 0) >= hi);
  const kg = loads[0]!;

  if (same && allTop) {
    if (assisted) {
      if (kg <= 0) return null; // ya sin asistencia: pasar a dominadas normales
      const to = Math.max(0, kg - Math.max(input.step * 2, roundTo(kg * 0.1, input.step)));
      return { kind: 'increase', fromKg: kg, toKg: to, reps: lo, field };
    }
    const inc = Math.max(input.step, roundTo(kg * 0.05, input.step));
    return { kind: 'increase', fromKg: kg, toKg: Math.round((kg + inc) * 100) / 100, reps: lo, field };
  }
  return { kind: 'reps', kg: same ? kg : Math.max(...loads), goalReps: hi, field };
}
