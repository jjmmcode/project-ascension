import { findOption } from './exerciseOptions';
import { getLibraryExercise } from '@/features/exercises/library';

/**
 * Descanso entre series. Por defecto 2 min en compuestos y 90 s en aislamiento: un metaanálisis
 * (Singer et al. 2024) halló un beneficio pequeño en hipertrofia por encima de 60 s y ninguna
 * diferencia apreciable por encima de 90 s. Isométricos (planchas): 60 s.
 */
const COMPOUND_IDS = new Set([
  'ek-0042', 'ek-0061', 'ek-0054', 'ek-0087', 'ek-9087', 'ek-0024', 'ek-0025', 'ek-0097',
  'ek-0004', 'ek-9307', 'ek-0127', 'ek-0118', 'ek-0121',
]);

export function restSecondsFor(exerciseId: string): number {
  const libId = findOption(exerciseId)?.libraryId ?? exerciseId;
  if (getLibraryExercise(libId)?.measure === 'time') return 60;
  return COMPOUND_IDS.has(libId) ? 120 : 90;
}

