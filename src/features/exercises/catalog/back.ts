import type { Limb, Pose } from '../figure/kinematics';
import { pullup } from './pullups';
import type { ExerciseTechnique } from './types';

const FLOOR = 200;

// ─── Dominadas con agarre abierto ─────────────────────────
// En vista lateral el ancho del agarre no se ve; cambian la inclinación y el recorrido.
const wideHands = { target: { x: 110, y: 42 }, bend: 'front' as const };
const wideLegs: Pose['legs'] = [
  { angle: 8, flex: 70 },
  { angle: 4, flex: 62 },
];
export const pullupWide: ExerciseTechnique = {
  ...pullup,
  id: 'pullup-wide',
  variantLabel: 'Agarre abierto',
  primary: ['lats'],
  secondary: ['upperBack', 'biceps'],
  keyframes: [
    { pose: { hip: { x: 114, y: 150 }, torso: -6, head: 0, arms: [wideHands, wideHands], legs: wideLegs }, moveMs: 1800, holdMs: 400, phase: 'Abajo: cuelga con las escápulas activas' },
    { pose: { hip: { x: 114, y: 116 }, torso: -18, head: -8, arms: [wideHands, wideHands], legs: wideLegs }, moveMs: 1400, holdMs: 400, phase: 'Arriba: pecho hacia la barra, codos abajo y atrás' },
  ],
  cues: {
    setup: ['Agarre prono a una vez y media el ancho de los hombros.', 'No más ancho: reduce el recorrido y carga el hombro.'],
    execution: [
      'Junta y baja las escápulas antes de tirar.',
      'Tira llevando los codos hacia abajo y hacia los costados hasta acercar la parte alta del pecho a la barra.',
      'Baja en 2–3 s hasta extender los brazos.',
    ],
    focus: [
      'El agarre abierto pone el énfasis en la parte alta y externa de los dorsales: piensa en "codos a las costillas".',
      'Inclina ligeramente el torso hacia atrás al subir.',
    ],
    mistakes: ['Agarre demasiado ancho.', 'Subir solo hasta la barbilla moviendo la cabeza hacia delante.', 'Balancearse.'],
    regressions: ['Con banda elástica.', 'Jalón al pecho con agarre abierto.'],
  },
};

// ─── Remo con mancuerna apoyado en banco ──────────────────
// La rodilla y la mano del lado lejano se apoyan en el banco; rema el brazo cercano.
const BENCH_Y = 160;
const rowLegs: Pose['legs'] = [
  { target: { x: 92, y: FLOOR - 12 }, bend: 'front' }, // pierna cercana en el suelo
  { angle: 0, flex: 92 }, // rodilla lejana sobre el banco
];
const rowFarHand: Limb = { target: { x: 146, y: BENCH_Y - 3 }, bend: 'back' };
const rowPose = (near: Limb): Pose => ({ hip: { x: 80, y: 118 }, torso: 78, head: 6, arms: [near, rowFarHand], legs: rowLegs });

export const dumbbellRow: ExerciseTechnique = {
  id: 'dumbbell-row',
  name: 'Remo con mancuerna en banco',
  group: 'dumbbell-row',
  category: 'gym',
  equipment: ['dumbbell', 'bench'],
  primary: ['lats'],
  secondary: ['upperBack', 'biceps'],
  viewBox: [30, 50, 170, 160],
  props: [
    { type: 'floor', y: FLOOR },
    { type: 'bench', x: 60, y: BENCH_Y, width: 110, height: FLOOR - BENCH_Y },
    { type: 'dumbbells', only: 'near' },
  ],
  keyframes: [
    { pose: rowPose({ angle: 2, flex: 2 }), moveMs: 1900, holdMs: 300, phase: 'Abajo: brazo estirado, espalda plana' },
    { pose: rowPose({ angle: -72, flex: 76 }), moveMs: 1200, holdMs: 450, phase: 'Arriba: codo hacia la cadera' },
  ],
  cues: {
    setup: [
      'Rodilla y mano del mismo lado sobre el banco; el otro pie en el suelo.',
      'Espalda plana, casi paralela al suelo, y la mirada un poco por delante.',
    ],
    execution: [
      'Tira de la mancuerna llevando el codo hacia la cadera, pegado al cuerpo.',
      'Junta la escápula arriba un instante.',
      'Baja en 2 s hasta estirar el brazo y sentir el estiramiento del dorsal.',
    ],
    focus: [
      'Codo hacia la cadera, no hacia el hombro: así trabaja el dorsal y no solo el bíceps.',
      'El torso no gira: si rotas para subir, es demasiado peso.',
    ],
    mistakes: ['Redondear la espalda.', 'Girar el torso.', 'Tirar con la mano en vez de con el codo.'],
  },
};

// ─── Remo sentado en polea, agarre cerrado ────────────────
const SEAT_Y = 168;
const cableRowLegs: Pose['legs'] = [
  { target: { x: 150, y: 176 }, bend: 'front' },
  { target: { x: 150, y: 176 }, bend: 'front' },
];
const cableRow = (torso: number, hand: { x: number; y: number }): Pose => ({
  hip: { x: 70, y: SEAT_Y - 6 },
  torso,
  head: 0,
  arms: [
    { target: hand, bend: 'back' },
    { target: hand, bend: 'back' },
  ],
  legs: cableRowLegs,
});

export const seatedCableRow: ExerciseTechnique = {
  id: 'seated-cable-row',
  name: 'Remo sentado en polea',
  variantLabel: 'Agarre cerrado',
  group: 'seated-cable-row',
  category: 'gym',
  equipment: ['cable'],
  primary: ['lats', 'upperBack'],
  secondary: ['biceps'],
  viewBox: [20, 60, 200, 150],
  props: [
    { type: 'floor', y: FLOOR },
    { type: 'pad', a: { x: 30, y: SEAT_Y }, b: { x: 110, y: SEAT_Y }, w: 8 },
    { type: 'pad', a: { x: 156, y: 160 }, b: { x: 160, y: 190 }, w: 6 }, // apoyo de pies
    { type: 'cable', anchor: { x: 212, y: 170 } },
  ],
  keyframes: [
    { pose: cableRow(16, { x: 144, y: 136 }), moveMs: 1900, holdMs: 250, phase: 'Inicio: brazos estirados, espalda recta' },
    { pose: cableRow(0, { x: 92, y: 140 }), moveMs: 1200, holdMs: 450, phase: 'Final: agarre al abdomen, escápulas juntas' },
  ],
  cues: {
    setup: ['Pies en los apoyos, rodillas levemente flexionadas.', 'Agarre en V (cerrado), brazos estirados y espalda recta.'],
    execution: [
      'Lleva el torso a la vertical y tira del agarre hacia el abdomen.',
      'Codos pegados al cuerpo, pasando junto a las costillas.',
      'Junta las escápulas un segundo y vuelve controlando.',
    ],
    focus: [
      'Con agarre cerrado los codos van pegados: más trabajo de dorsales y espalda media.',
      'Empieza el movimiento juntando las escápulas, después flexiona los codos.',
    ],
    mistakes: ['Balancear el torso hacia atrás para mover más peso.', 'Redondear la espalda al volver.', 'Encoger los hombros.'],
  },
};

// ─── Jalón al pecho, agarre abierto ───────────────────────
const PD_SEAT_Y = 150;
const pdLegs: Pose['legs'] = [
  { angle: 84, flex: 88 },
  { angle: 82, flex: 86 },
];
const pulldown = (torso: number, hand: { x: number; y: number }, bend: 'front' | 'back'): Pose => ({
  hip: { x: 92, y: PD_SEAT_Y - 6 },
  torso,
  head: torso < -10 ? -6 : 0,
  arms: [
    { target: hand, bend },
    { target: hand, bend },
  ],
  legs: pdLegs,
});

export const latPulldownWide: ExerciseTechnique = {
  id: 'lat-pulldown-wide',
  name: 'Jalón al pecho',
  variantLabel: 'Agarre abierto',
  group: 'lat-pulldown',
  category: 'gym',
  equipment: ['cable'],
  primary: ['lats'],
  secondary: ['upperBack', 'biceps'],
  viewBox: [30, 0, 170, 210],
  props: [
    { type: 'floor', y: FLOOR },
    { type: 'pad', a: { x: 60, y: PD_SEAT_Y }, b: { x: 120, y: PD_SEAT_Y }, w: 8 },
    { type: 'pad', a: { x: 120, y: 128 }, b: { x: 150, y: 128 }, w: 7 }, // almohadilla de muslos
    { type: 'cable', anchor: { x: 104, y: 6 } },
  ],
  keyframes: [
    { pose: pulldown(-8, { x: 104, y: 30 }, 'front'), moveMs: 1900, holdMs: 250, phase: 'Arriba: brazos estirados, dorsales en estiramiento' },
    { pose: pulldown(-16, { x: 104, y: 90 }, 'front'), moveMs: 1200, holdMs: 450, phase: 'Abajo: barra a la parte alta del pecho' },
  ],
  cues: {
    setup: [
      'Ajusta la almohadilla para que fije los muslos.',
      'Agarre prono a una vez y media el ancho de los hombros.',
    ],
    execution: [
      'Inclina el torso unos 10–20° hacia atrás y saca el pecho.',
      'Baja la barra hacia la parte alta del pecho llevando los codos hacia abajo y a los costados.',
      'Sube controlando hasta estirar los brazos por completo.',
    ],
    focus: [
      'Imagina que llevas los codos a los bolsillos traseros: el dorsal hace el trabajo, no los brazos.',
      'El torso se queda quieto: no te balancees para bajar la barra.',
    ],
    mistakes: [
      'Bajar la barra por detrás de la nuca.',
      'Echar el cuerpo muy atrás convirtiéndolo en un remo.',
      'Subir rápido sin controlar.',
    ],
  },
};
