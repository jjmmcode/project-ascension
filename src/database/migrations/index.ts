import { m001Initial } from './001_initial';
import { m002LoadModes } from './002_load_modes';
import { m003PlanAndProfile } from './003_plan_and_profile';
import { m004ExerciseSwap } from './004_exercise_swap';
import { m005WorkoutEnergy } from './005_workout_energy';
import { m006Penance } from './006_penance';
import { m007Cardio } from './007_cardio';

export interface Migration {
  /** Entero creciente, sin huecos. Nunca modificar una migración ya publicada: crear una nueva. */
  version: number;
  name: string;
  statements: string[];
}

export const MIGRATIONS: Migration[] = [m001Initial, m002LoadModes, m003PlanAndProfile, m004ExerciseSwap, m005WorkoutEnergy, m006Penance, m007Cardio];
