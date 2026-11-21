import type { Pose } from '../figure/kinematics';
import type { ExerciseTechnique } from './types';

/** Barra paralela (vista lateral): la mano queda fija sobre ella. */
const BAR = { x: 110, y: 120 };
const HANDS = { target: BAR, bend: 'back' as const };

// Piernas cruzadas y rodillas flexionadas hacia atrás (versión pecho).
const legsBent = (thigh: number): Pose['legs'] => [
  { angle: thigh, flex: 62 },
  { angle: thigh - 5, flex: 55 },
];

// Piernas casi rectas y verticales (versión tríceps: favorece el tronco vertical).
const legsStraight = (thigh: number): Pose['legs'] => [
  { angle: thigh, flex: 8 },
  { angle: thigh - 4, flex: 12 },
];

const chestTop: Pose = { hip: { x: 98, y: 116 }, torso: 14, head: 6, arms: [HANDS, HANDS], legs: legsBent(-4) };
const chestBottom: Pose = { hip: { x: 104, y: 136 }, torso: 42, head: 10, arms: [HANDS, HANDS], legs: legsBent(-26) };

const triTop: Pose = { hip: { x: 104, y: 115 }, torso: 4, head: 0, arms: [HANDS, HANDS], legs: legsStraight(4) };
const triBottom: Pose = { hip: { x: 118, y: 130 }, torso: 8, head: 2, arms: [HANDS, HANDS], legs: legsStraight(6) };

const shared = {
  group: 'dips',
  category: 'calisthenics' as const,
  equipment: ['parallel_bars' as const],
  viewBox: [20, 10, 180, 220] as [number, number, number, number],
  props: [{ type: 'parallelBars' as const, at: BAR }],
};

export const dipsChest: ExerciseTechnique = {
  ...shared,
  id: 'dips-chest',
  name: 'Fondos en paralelas',
  variantLabel: 'Énfasis pecho',
  primary: ['chest'],
  secondary: ['triceps', 'frontDelts'],
  keyframes: [
    { pose: chestTop, moveMs: 1100, holdMs: 400, phase: 'Arriba: brazos extendidos, torso ya inclinado' },
    { pose: chestBottom, moveMs: 2200, holdMs: 350, phase: 'Bajada controlada (2–3 s)' },
  ],
  cues: {
    setup: [
      'Agarre algo más ancho que los hombros si tus paralelas lo permiten.',
      'Desde arriba, inclina el torso hacia delante unos 30–45° antes de empezar.',
      'Rodillas flexionadas y pies cruzados detrás: ayudan a mantener la inclinación.',
    ],
    execution: [
      'Baja controlando 2–3 s hasta que los hombros queden a la altura de los codos, o algo por debajo si no hay molestia.',
      'Los codos se abren ligeramente hacia fuera (unos 30–45° respecto al cuerpo).',
      'Empuja hacia arriba y hacia delante manteniendo la inclinación.',
    ],
    focus: [
      'La inclinación del torso es lo que lleva el trabajo al pecho: si te enderezas, pasa al tríceps.',
      'Siente el estiramiento del pecho abajo y júntalo al subir.',
    ],
    mistakes: [
      'Bajar más de lo que tus hombros toleran: detente si notas pinchazo en la parte delantera del hombro.',
      'Encoger los hombros hacia las orejas: mantenlos lejos de ellas, deprimidos.',
      'Rebotar abajo.',
    ],
    regressions: ['Fondos con banda elástica o en máquina asistida.', 'Solo fase excéntrica (bajar lento, subir apoyándote).'],
    progressions: ['Añadir lastre con cinturón o mochila.', 'Pausa de 2 s abajo.'],
  },
};

export const dipsTriceps: ExerciseTechnique = {
  ...shared,
  id: 'dips-triceps',
  name: 'Fondos en paralelas',
  variantLabel: 'Énfasis tríceps',
  primary: ['triceps'],
  secondary: ['chest', 'frontDelts'],
  keyframes: [
    { pose: triTop, moveMs: 1100, holdMs: 400, phase: 'Arriba: torso vertical, codos bloqueados' },
    { pose: triBottom, moveMs: 2200, holdMs: 350, phase: 'Bajada controlada, codos hacia atrás' },
  ],
  cues: {
    setup: [
      'Agarre al ancho de los hombros.',
      'Torso lo más vertical posible y piernas rectas hacia abajo.',
    ],
    execution: [
      'Baja controlando 2–3 s llevando los codos hacia atrás, pegados al cuerpo.',
      'Detente con el codo cerca de 90°.',
      'Sube hasta extender los codos por completo.',
    ],
    focus: [
      'Torso recto y codos cerrados: así el tríceps hace la mayor parte del trabajo.',
      'Aprieta el tríceps en la extensión completa arriba.',
    ],
    mistakes: [
      'Inclinarse hacia delante al cansarse: convierte el ejercicio en fondos de pecho.',
      'Abrir los codos hacia fuera.',
      'Encoger los hombros.',
    ],
    regressions: ['Fondos en banco con pies en el suelo.', 'Fondos con banda elástica.'],
    progressions: ['Añadir lastre.', 'Tempo lento 4 s en la bajada.'],
  },
};
