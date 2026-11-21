import { getLibraryExercise, type MuscleGroup } from '@/features/exercises/library';
import { findOption } from './exerciseOptions';

/** Músculos principales de un ejercicio guardado (biblioteca, o su equivalente de la biblioteca). */
export function primaryMuscles(exerciseId: string): MuscleGroup[] {
  const libId = findOption(exerciseId)?.libraryId ?? exerciseId;
  return getLibraryExercise(libId)?.primary ?? [];
}
