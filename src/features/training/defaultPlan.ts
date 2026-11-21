/**
 * Plan semanal aprobado por el usuario el 19-11-2026 (gimnasio completo).
 * Esquemas habituales del usuario: 4×10 (compuestos), 4×12, 4×15 (aislamiento) y 4×20 (gemelos, antebrazo).
 * Evidencia resumida en docs/TRAINING_PLAN.md. Todo es editable desde la app.
 */
export type TemplateKind = 'calisthenics' | 'gym' | 'hybrid' | 'cardio';

export interface PlanExercise {
  /** Id de la biblioteca ("ek-0042"). */
  exerciseId: string;
  sets: number;
  /** Texto del objetivo: "10", "10–12", "12 por pierna", "30–45 s". El primer número precarga la serie. */
  target: string;
  notes?: string;
}

export interface PlanTemplate {
  key: string;
  name: string;
  description: string;
  kind: TemplateKind;
  exercises: PlanExercise[];
}

export const DEFAULT_TEMPLATES: PlanTemplate[] = [
  {
    key: 'push',
    name: 'Pecho y tríceps',
    description: '~55 min · 20 series. Termina cada serie con 1–3 repeticiones en reserva.',
    kind: 'gym',
    exercises: [
      { exerciseId: 'ek-0042', sets: 4, target: '10' },
      { exerciseId: 'ek-0061', sets: 4, target: '12' },
      { exerciseId: 'ek-0054', sets: 4, target: '10–12', notes: 'Con lastre o asistidos según el día' },
      { exerciseId: 'ek-0206', sets: 4, target: '12' },
      { exerciseId: 'ek-0194', sets: 4, target: '15' },
    ],
  },
  {
    key: 'pull',
    name: 'Bíceps y espalda',
    description: '32 series. Si vas justo de tiempo, quita el curl alterno y el remo en polea.',
    kind: 'gym',
    exercises: [
      { exerciseId: 'ek-0211', sets: 4, target: '10' },
      { exerciseId: 'ek-0239', sets: 4, target: '12' },
      { exerciseId: 'ek-0253', sets: 4, target: '12' },
      { exerciseId: 'ek-0223', sets: 4, target: '15', notes: 'Opcional si vas justo de tiempo' },
      { exerciseId: 'ek-0087', sets: 4, target: '10', notes: 'O dominadas asistidas en máquina' },
      { exerciseId: 'ek-0024', sets: 4, target: '12' },
      { exerciseId: 'ek-0025', sets: 4, target: '12', notes: 'Opcional si vas justo de tiempo' },
      { exerciseId: 'ek-0097', sets: 4, target: '12' },
    ],
  },
  {
    key: 'core',
    name: 'Core y zona lumbar',
    description: '~20 min. Big 3 de McGill + complementos. Movimientos lentos y controlados.',
    kind: 'calisthenics',
    exercises: [
      { exerciseId: 'ek-9301', sets: 3, target: '6', notes: 'Mantén 8–10 s cada repetición' },
      { exerciseId: 'ek-0113', sets: 3, target: '20–30 s', notes: 'Por lado' },
      { exerciseId: 'ek-9302', sets: 3, target: '6 por lado', notes: 'Mantén 8–10 s cada repetición' },
      { exerciseId: 'ek-9303', sets: 3, target: '10 por lado' },
      { exerciseId: 'ek-9304', sets: 3, target: '30–45 s' },
      { exerciseId: 'ek-9305', sets: 3, target: '15' },
    ],
  },
  {
    key: 'shoulders',
    name: 'Hombro y antebrazo',
    description: '~55 min · 20–24 series.',
    kind: 'gym',
    exercises: [
      { exerciseId: 'ek-0004', sets: 4, target: '10' },
      { exerciseId: 'ek-0018', sets: 4, target: '15' },
      { exerciseId: 'ek-9308', sets: 4, target: '12' },
      { exerciseId: 'ek-0035', sets: 4, target: '15' },
      { exerciseId: 'ek-0005', sets: 4, target: '12', notes: 'Opcional' },
      { exerciseId: 'ek-0257', sets: 4, target: '15' },
      { exerciseId: 'ek-9306', sets: 4, target: '20' },
    ],
  },
  {
    key: 'legs',
    name: 'Pierna',
    description: '~60 min · 24 series. Prensa en vez de sentadilla para cuidar la zona lumbar.',
    kind: 'gym',
    exercises: [
      { exerciseId: 'ek-0127', sets: 4, target: '12' },
      { exerciseId: 'ek-0118', sets: 4, target: '10', notes: 'Si molesta la zona lumbar, cámbialo por más curl femoral' },
      { exerciseId: 'ek-0121', sets: 4, target: '12 por pierna' },
      { exerciseId: 'ek-0142', sets: 4, target: '15' },
      { exerciseId: 'ek-0117', sets: 4, target: '12' },
      { exerciseId: 'ek-0282', sets: 4, target: '20' },
    ],
  },
  {
    key: 'cardio',
    name: 'Cardio: caminadora',
    description: 'Caminata en cinta. El registro de velocidad, inclinación y minutos llega en la Fase 2.',
    kind: 'cardio',
    exercises: [],
  },
];

/** Día ISO (1 = lunes … 7 = domingo) → clave de rutina. Miércoles: core (o descanso). */
export const DEFAULT_SCHEDULE: Record<number, string> = {
  1: 'push',
  2: 'pull',
  3: 'core',
  4: 'shoulders',
  5: 'legs',
  6: 'cardio',
  7: 'cardio',
};

/** Días en que la rutina es opcional (se puede descansar). Según el usuario: solo el miércoles. */
export const OPTIONAL_DAYS = new Set([3]);

export const WEEKDAY_LABEL: Record<number, string> = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
  7: 'Domingo',
};

/** Primer número del objetivo ("10–12" → 10, "30–45 s" → 30). */
export function firstNumber(target: string): number | null {
  const m = target.match(/\d+/);
  return m ? Number(m[0]) : null;
}
