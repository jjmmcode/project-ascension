import { dipsChest, dipsTriceps } from './dips';
import { pullup, chinup } from './pullups';
import { pushup, pushupClose } from './pushups';
import { alternatingCurl, barbellCurl, preacherCurl } from './biceps';
import { dumbbellRow, latPulldownWide, pullupWide, seatedCableRow } from './back';
import type { ExerciseTechnique } from './types';

export type { ExerciseTechnique } from './types';
export { MUSCLE_LABEL } from './types';

export const EXERCISE_TECHNIQUES: ExerciseTechnique[] = [
  dipsChest,
  dipsTriceps,
  pushup,
  pushupClose,
  pullup,
  pullupWide,
  chinup,
  barbellCurl,
  preacherCurl,
  alternatingCurl,
  dumbbellRow,
  seatedCableRow,
  latPulldownWide,
];

export const getTechnique = (id: string) => EXERCISE_TECHNIQUES.find((e) => e.id === id) ?? null;

export const getVariants = (group: string) => EXERCISE_TECHNIQUES.filter((e) => e.group === group);
