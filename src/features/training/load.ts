/**
 * Carga efectiva por serie (lógica pura).
 * - external: lo que marca la pesa o la máquina.
 * - bodyweight: peso corporal + lastre (dominadas, fondos).
 * - assisted: peso corporal − asistencia (máquina de dominadas asistidas).
 * Referencia: Hevy usa la misma convención (carga efectiva = peso corporal − asistencia).
 * En máquinas que no son 1:1 el valor es aproximado: lo que mide el progreso es la tendencia.
 */
export type LoadMode = 'external' | 'bodyweight' | 'assisted';

export function effectiveLoadKg(
  mode: LoadMode,
  values: { weightKg: number | null; assistanceKg: number | null; bodyweightKg: number | null },
): number | null {
  if (mode === 'external') return values.weightKg;
  if (values.bodyweightKg == null) return null;
  if (mode === 'bodyweight') return values.bodyweightKg + (values.weightKg ?? 0);
  return values.bodyweightKg - (values.assistanceKg ?? 0);
}

/** Mensaje de error si la combinación no tiene sentido, o null si es válida. */
export function validateAssistance(assistanceKg: number | null, bodyweightKg: number | null): string | null {
  if (assistanceKg == null || bodyweightKg == null) return null;
  if (assistanceKg >= bodyweightKg) return 'La asistencia no puede ser igual o mayor que tu peso.';
  return null;
}

/** Peso corporal a usar: la última medición confirmada de los últimos 30 días. */
export function usableBodyweight(
  latest: { weightKg: number | null; measuredAt: string; dataStatus: string } | null,
  now: Date = new Date(),
): number | null {
  if (!latest || latest.weightKg == null || latest.dataStatus !== 'confirmed') return null;
  const ageDays = (now.getTime() - new Date(latest.measuredAt).getTime()) / 86_400_000;
  return ageDays <= 30 ? latest.weightKg : null;
}
