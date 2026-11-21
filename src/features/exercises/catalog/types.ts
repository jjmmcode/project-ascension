import type { Keyframe } from '../figure/kinematics';
import type { Muscle, Prop } from '../figure/scene';

export type Equipment = 'bodyweight' | 'parallel_bars' | 'pullup_bar' | 'dumbbell' | 'barbell' | 'bench' | 'cable' | 'machine';

export interface ExerciseTechnique {
  /** Identificador estable (se usará como `exercises.id` del catálogo base). */
  id: string;
  name: string;
  /** Ejercicios que son variantes del mismo movimiento comparten grupo (p. ej. "dips"). */
  group: string;
  /** Etiqueta corta de la variante dentro del grupo: "Pecho", "Tríceps". */
  variantLabel?: string;
  category: 'calisthenics' | 'gym' | 'cardio' | 'mobility';
  equipment: Equipment[];
  primary: Muscle[];
  secondary: Muscle[];
  /** Encuadre de la animación: [x, y, ancho, alto]. */
  viewBox: [number, number, number, number];
  props: Prop[];
  keyframes: Keyframe[];
  cues: {
    setup: string[];
    execution: string[];
    /** En qué poner énfasis para que trabaje el músculo objetivo. */
    focus: string[];
    mistakes: string[];
    /** Opcional: cómo hacerlo más fácil o más difícil. */
    regressions?: string[];
    progressions?: string[];
  };
}

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: 'Pecho',
  triceps: 'Tríceps',
  biceps: 'Bíceps',
  frontDelts: 'Deltoides anterior',
  lats: 'Dorsales',
  upperBack: 'Espalda alta',
  core: 'Core',
  glutes: 'Glúteos',
  quads: 'Cuádriceps',
  hamstrings: 'Isquiotibiales',
  calves: 'Gemelos',
};
