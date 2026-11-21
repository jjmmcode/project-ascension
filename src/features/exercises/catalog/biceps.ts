import type { Limb, Pose } from '../figure/kinematics';
import type { ExerciseTechnique } from './types';

const FLOOR = 200;
/** De pie, con las rodillas apenas flexionadas. */
const standingLegs: Pose['legs'] = [
  { angle: 2, flex: 4 },
  { angle: -2, flex: 4 },
];
const STAND_HIP = { x: 100, y: FLOOR - 84 + 1 };

const arm = (angle: number, flex: number): Limb => ({ angle, flex });
const standing = (near: Limb, far: Limb, torso = 0): Pose => ({
  hip: STAND_HIP,
  torso,
  head: 0,
  arms: [near, far],
  legs: standingLegs,
});

// ─── Curl con barra ────────────────────────────────────────
export const barbellCurl: ExerciseTechnique = {
  id: 'barbell-curl',
  name: 'Curl de bíceps con barra',
  group: 'barbell-curl',
  category: 'gym',
  equipment: ['barbell'],
  primary: ['biceps'],
  secondary: [],
  viewBox: [40, 10, 140, 200],
  props: [{ type: 'floor', y: FLOOR }, { type: 'barbell' }],
  keyframes: [
    { pose: standing(arm(4, 4), arm(4, 4)), moveMs: 2200, holdMs: 300, phase: 'Abajo: brazos extendidos, codos a los costados' },
    { pose: standing(arm(10, 138), arm(10, 138)), moveMs: 1300, holdMs: 400, phase: 'Arriba: aprieta el bíceps' },
  ],
  cues: {
    setup: ['De pie, pies al ancho de caderas, rodillas apenas flexionadas.', 'Agarre supino (palmas hacia delante) al ancho de los hombros.'],
    execution: [
      'Sube la barra flexionando solo los codos, que se quedan junto al cuerpo.',
      'Aprieta arriba sin llevar los codos hacia delante.',
      'Baja en 2–3 s hasta extender los brazos por completo.',
    ],
    focus: [
      'Los codos son una bisagra fija: si se adelantan, trabaja el hombro y no el bíceps.',
      'La bajada lenta es la mitad del ejercicio.',
    ],
    mistakes: ['Balancear el torso para subir la barra.', 'Cortar el recorrido abajo.', 'Encoger los hombros.'],
    regressions: ['Menos peso con recorrido completo.'],
    progressions: ['Pausa de 1 s arriba.', 'Bajada en 4 s.'],
  },
};

// ─── Curl predicador ──────────────────────────────────────
// Sentado, el brazo apoyado en un cojín inclinado: el húmero no se mueve.
const preacherBase: Omit<Pose, 'arms'> = {
  hip: { x: 70, y: 150 },
  torso: 22,
  head: 6,
  legs: [
    { angle: 82, flex: 88 },
    { angle: 80, flex: 84 },
  ],
};
const preacher = (flex: number): Pose => ({ ...preacherBase, arms: [arm(42, flex), arm(42, flex)] });

export const preacherCurl: ExerciseTechnique = {
  id: 'preacher-curl',
  name: 'Curl predicador',
  group: 'preacher-curl',
  category: 'gym',
  equipment: ['barbell', 'bench'],
  primary: ['biceps'],
  secondary: [],
  viewBox: [30, 30, 170, 180],
  props: [
    { type: 'floor', y: FLOOR },
    { type: 'pad', a: { x: 40, y: 154 }, b: { x: 92, y: 154 }, w: 8 }, // asiento
    { type: 'pad', a: { x: 86, y: 108 }, b: { x: 124, y: 146 }, w: 9 }, // cojín inclinado
    { type: 'pad', a: { x: 100, y: 146 }, b: { x: 100, y: FLOOR }, w: 4 },
    { type: 'barbell' },
  ],
  keyframes: [
    { pose: preacher(12), moveMs: 2400, holdMs: 300, phase: 'Abajo: codo casi extendido (sin bloquear)' },
    { pose: preacher(112), moveMs: 1300, holdMs: 450, phase: 'Arriba: contracción máxima' },
  ],
  cues: {
    setup: [
      'Ajusta el asiento para que la axila quede apoyada en el borde superior del cojín.',
      'La parte trasera de los brazos queda completamente apoyada.',
    ],
    execution: [
      'Sube flexionando los codos sin despegar los brazos del cojín.',
      'Baja muy controlado (3 s) hasta casi extender el codo.',
    ],
    focus: [
      'Este ejercicio aísla la parte baja del recorrido: la bajada lenta y el estiramiento abajo son lo que más trabaja.',
      'No despegues los codos ni levantes los hombros para ayudarte.',
    ],
    mistakes: [
      'Dejar caer el peso abajo: es donde el codo está más expuesto.',
      'Bloquear el codo en extensión completa con carga.',
      'Subir los hombros o inclinarse hacia atrás.',
    ],
    regressions: ['Menos carga con más control abajo.'],
  },
};

// ─── Curl alterno en supinación ───────────────────────────
const down = arm(4, 4);
const up = arm(10, 138);

export const alternatingCurl: ExerciseTechnique = {
  id: 'alternating-curl',
  name: 'Curl alterno en supinación',
  group: 'alternating-curl',
  category: 'gym',
  equipment: ['dumbbell', 'machine'],
  primary: ['biceps'],
  secondary: [],
  viewBox: [40, 10, 140, 200],
  props: [{ type: 'floor', y: FLOOR }, { type: 'dumbbells' }],
  keyframes: [
    { pose: standing(down, down), moveMs: 1800, holdMs: 250, phase: 'Ambos brazos abajo' },
    { pose: standing(up, down), moveMs: 1200, holdMs: 350, phase: 'Brazo cercano: sube girando la palma hacia arriba' },
    { pose: standing(down, down), moveMs: 1800, holdMs: 250, phase: 'Baja controlando' },
    { pose: standing(down, up), moveMs: 1200, holdMs: 350, phase: 'Ahora el otro brazo' },
  ],
  cues: {
    setup: [
      'Vale para mancuernas o para la máquina de curl alterno: la técnica es la misma.',
      'Empieza con las palmas mirando al cuerpo (neutro).',
    ],
    execution: [
      'Sube un brazo girando la muñeca hasta que la palma mire hacia arriba (supinación).',
      'Aprieta arriba, baja controlando y cambia de brazo.',
    ],
    focus: [
      'La supinación (girar la palma hacia arriba) es una función del bíceps: complétala arriba para contraerlo al máximo.',
      'El codo del brazo que trabaja no se adelanta.',
    ],
    mistakes: ['Balancear el torso de lado a lado.', 'Bajar rápido para empezar con el otro brazo.'],
  },
};
