import type { Pose, Vec } from '../figure/kinematics';
import { BONES } from '../figure/kinematics';
import type { ExerciseTechnique } from './types';

const FLOOR = 200;
/** Tobillo apoyado (los dedos tocan el suelo). */
const ANKLE: Vec = { x: 40, y: FLOOR - 12 };
const LEG = BONES.thigh + BONES.shin;
const BODY = LEG + BONES.torso;

/**
 * Plancha rígida: el cuerpo es una línea recta que gira sobre el tobillo.
 * `angleDeg` = elevación del cuerpo sobre la horizontal.
 */
function plank(angleDeg: number, hands: Vec, extra: Partial<Pose> = {}): Pose {
  const a = (angleDeg * Math.PI) / 180;
  const dir = { x: Math.cos(a), y: -Math.sin(a) };
  const hip = { x: ANKLE.x + dir.x * LEG, y: ANKLE.y + dir.y * LEG };
  const torso = 90 - angleDeg; // desde la vertical hacia delante
  const arm = { target: hands, bend: 'back' as const };
  const leg = { target: ANKLE, bend: 'front' as const };
  void BODY;
  return { hip, torso, head: 0, arms: [arm, arm], legs: [leg, leg], ...extra };
}

const HANDS: Vec = { x: 166, y: FLOOR - 4 };
const WIDE_HANDS: Vec = { x: 168, y: FLOOR - 4 };

const shared = {
  group: 'pushups',
  category: 'calisthenics' as const,
  equipment: ['bodyweight' as const],
  viewBox: [10, 90, 220, 120] as [number, number, number, number],
  props: [{ type: 'floor' as const, y: FLOOR }],
};

export const pushup: ExerciseTechnique = {
  ...shared,
  id: 'pushup',
  name: 'Flexiones',
  variantLabel: 'Estándar',
  primary: ['chest'],
  secondary: ['triceps', 'frontDelts', 'core'],
  keyframes: [
    { pose: plank(22, HANDS), moveMs: 1000, holdMs: 350, phase: 'Arriba: cuerpo en línea recta' },
    { pose: plank(9, HANDS), moveMs: 1800, holdMs: 300, phase: 'Bajada controlada, codos a ~45°' },
  ],
  cues: {
    setup: [
      'Manos un poco más abiertas que los hombros, bajo el pecho.',
      'Apoyado en las puntas de los pies, con abdomen y glúteos activos.',
    ],
    execution: [
      'Baja el pecho en 2 s hasta quedar a pocos centímetros del suelo.',
      'Empuja el suelo hasta extender los brazos.',
    ],
    focus: [
      'El cuerpo baja y sube en bloque, como una tabla: cadera y hombros a la vez.',
      'Codos a unos 45° del cuerpo, no abiertos en cruz.',
    ],
    mistakes: ['Dejar caer la cadera.', 'Levantar el trasero para acortar el recorrido.', 'Adelantar la cabeza hacia el suelo.'],
    regressions: ['Manos apoyadas en un banco (flexión inclinada).'],
    progressions: ['Pies elevados en un banco.', 'Pausa de 2 s abajo.'],
  },
};

export const pushupClose: ExerciseTechnique = {
  ...shared,
  id: 'pushup-close',
  name: 'Flexiones',
  variantLabel: 'Énfasis tríceps (cerradas)',
  primary: ['triceps'],
  secondary: ['chest', 'frontDelts', 'core'],
  keyframes: [
    { pose: plank(22, WIDE_HANDS), moveMs: 1000, holdMs: 350, phase: 'Arriba: manos juntas bajo el pecho' },
    { pose: plank(10, WIDE_HANDS), moveMs: 1800, holdMs: 300, phase: 'Bajada con codos pegados al cuerpo' },
  ],
  cues: {
    setup: ['Manos juntas bajo el pecho (pulgares e índices formando un triángulo).', 'Cuerpo en línea recta.'],
    execution: ['Baja con los codos rozando las costillas.', 'Empuja hasta extender los brazos por completo.'],
    focus: ['Codos hacia atrás, pegados al cuerpo: así el tríceps hace la mayor parte del trabajo.'],
    mistakes: ['Abrir los codos hacia fuera.', 'Perder la línea del cuerpo.'],
    regressions: ['Hazlas con las manos sobre un banco.'],
  },
};
