import type { Pose, Vec } from '../figure/kinematics';
import type { ExerciseTechnique } from './types';

const BAR: Vec = { x: 110, y: 40 };
const HANDS = { target: { x: 110, y: 42 }, bend: 'front' as const };

// Rodillas flexionadas y pies cruzados atrás: es lo habitual y evita tocar el suelo.
const legs = (thigh: number): Pose['legs'] => [
  { angle: thigh, flex: 70 },
  { angle: thigh - 4, flex: 62 },
];

const hang: Pose = { hip: { x: 113, y: 150 }, torso: -4, head: 0, arms: [HANDS, HANDS], legs: legs(6) };
const top: Pose = { hip: { x: 111, y: 113 }, torso: -12, head: -6, arms: [HANDS, HANDS], legs: legs(14) };

const chinHang: Pose = { hip: { x: 111, y: 150 }, torso: -2, head: 0, arms: [HANDS, HANDS], legs: legs(4) };
const chinTop: Pose = { hip: { x: 106.5, y: 114 }, torso: -5, head: -4, arms: [HANDS, HANDS], legs: legs(8) };

const shared = {
  group: 'pullups',
  category: 'calisthenics' as const,
  equipment: ['pullup_bar' as const],
  viewBox: [20, 20, 180, 220] as [number, number, number, number],
  props: [{ type: 'pullupBar' as const, at: BAR }],
};

export const pullup: ExerciseTechnique = {
  ...shared,
  id: 'pullup',
  name: 'Dominadas',
  variantLabel: 'Prono (dorsales)',
  primary: ['lats'],
  secondary: ['biceps', 'upperBack', 'core'],
  keyframes: [
    { pose: hang, moveMs: 1700, holdMs: 400, phase: 'Abajo: brazos extendidos, escápulas activas' },
    { pose: top, moveMs: 1300, holdMs: 400, phase: 'Arriba: pecho hacia la barra' },
  ],
  cues: {
    setup: ['Agarre prono (palmas hacia delante), algo más ancho que los hombros.', 'Cuelga con los brazos extendidos.'],
    execution: [
      'Antes de doblar los codos, baja y junta las escápulas.',
      'Tira llevando los codos hacia abajo y atrás hasta pasar la barbilla sobre la barra.',
      'Baja en 2–3 s hasta extender los brazos por completo.',
    ],
    focus: [
      'Piensa en llevar los codos a los bolsillos: así trabajan los dorsales y no solo los brazos.',
      'Pecho hacia la barra, con una ligera inclinación del torso hacia atrás arriba.',
    ],
    mistakes: ['Balancearse o patear.', 'Subir solo hasta media altura.', 'Encoger los hombros hacia las orejas abajo.'],
    regressions: ['Dominadas con banda elástica.', 'Negativas: sube con un salto y baja en 5 s.'],
    progressions: ['Añadir lastre.', 'Pausa de 2 s arriba.'],
  },
};

export const chinup: ExerciseTechnique = {
  ...shared,
  id: 'chinup',
  name: 'Dominadas',
  variantLabel: 'Supino (más bíceps)',
  primary: ['biceps', 'lats'],
  secondary: ['upperBack', 'core'],
  keyframes: [
    { pose: chinHang, moveMs: 1700, holdMs: 400, phase: 'Abajo: palmas hacia ti, brazos extendidos' },
    { pose: chinTop, moveMs: 1300, holdMs: 400, phase: 'Arriba: torso más vertical, barbilla sobre la barra' },
  ],
  cues: {
    setup: ['Agarre supino (palmas hacia ti), al ancho de los hombros.'],
    execution: ['Tira con los codos pegados al cuerpo hasta pasar la barbilla sobre la barra.', 'Baja controlando hasta extender los brazos.'],
    focus: ['El agarre supino y los codos cerrados meten más trabajo de bíceps.', 'Torso más vertical que en la versión prona.'],
    mistakes: ['Cortar el recorrido abajo.', 'Balancearse.'],
    regressions: ['Con banda elástica o negativas.'],
  },
};
