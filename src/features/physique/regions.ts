import type { MuscleGroup } from '@/features/exercises/library';
import type { BodyRegion } from '@/features/exercises/bodyMap/regions';

/** Zonas del mapa corporal que pinta cada grupo muscular. */
export const MUSCLE_REGIONS: Record<MuscleGroup, BodyRegion[]> = {
  chest: ['chest'],
  back: ['lats', 'traps', 'lowerBack'],
  shoulders: ['shoulders'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  forearms: ['forearms'],
  core: ['abs', 'obliques'],
  glutes: ['glutes'],
  quads: ['quads'],
  hamstrings: ['hamstrings'],
  calves: ['calves'],
  neck: ['neck'],
};
