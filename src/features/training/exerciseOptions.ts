import { EXERCISE_TECHNIQUES, MUSCLE_LABEL } from '@/features/exercises/catalog';
import { LIBRARY, MUSCLE_GROUP_LABEL, normalize } from '@/features/exercises/library';
import type { ExerciseRef } from '@/database/repositories/workouts';

/** Un ejercicio seleccionable en una sesión, venga de la técnica animada o de la biblioteca. */
export interface ExerciseOption {
  ref: ExerciseRef;
  subtitle: string;
  /** Ruta para ver la técnica: animación propia o ficha de biblioteca. */
  techniqueId?: string;
  libraryId?: string;
  fitsMyEquipment: boolean;
}

/**
 * Equivalente en la biblioteca (ilustración realista) de cada animación de palitos.
 * Sirve para sesiones antiguas que ya contienen ejercicios "tech-…".
 */
const TECH_TO_LIBRARY: Record<string, string> = {
  'dips-chest': 'ek-0054',
  'dips-triceps': 'ek-0172',
  pushup: 'ek-0077',
  'pushup-close': 'ek-0188',
  pullup: 'ek-0087',
  'pullup-wide': 'ek-0087',
  chinup: 'ek-0090',
  'barbell-curl': 'ek-0211',
  'preacher-curl': 'ek-0239',
  'alternating-curl': 'ek-0223',
  'dumbbell-row': 'ek-0024',
  'seated-cable-row': 'ek-0025',
  'lat-pulldown-wide': 'ek-0097',
};

const techOptions: ExerciseOption[] = EXERCISE_TECHNIQUES.map((t) => ({
  ref: {
    id: `tech-${t.id}`,
    name: t.variantLabel ? `${t.name} · ${t.variantLabel}` : t.name,
    category: t.category,
    primaryMuscle: t.primary[0] ?? 'core',
    equipment: t.equipment.join(','),
    isBodyweight: t.equipment.every((e) => e === 'bodyweight' || e === 'parallel_bars' || e === 'pullup_bar'),
    loadMode: ['dips-chest', 'dips-triceps', 'pullup', 'pullup-wide', 'chinup'].includes(t.id) ? 'bodyweight' : 'external',
    exerciseType: 'reps',
  },
  subtitle: t.primary.map((m) => MUSCLE_LABEL[m]).join(' · ') + ' · Animación',
  techniqueId: t.id,
  libraryId: TECH_TO_LIBRARY[t.id],
  fitsMyEquipment: true,
}));

const libOptions: ExerciseOption[] = LIBRARY.map((e) => ({
  ref: {
    id: e.id,
    name: e.name,
    category: 'gym',
    primaryMuscle: e.primary[0] ?? 'core',
    equipment: e.equipment.join(','),
    isBodyweight: e.loadMode !== 'external',
    loadMode: e.loadMode,
    exerciseType: e.measure,
  },
  subtitle: e.primary.map((m) => MUSCLE_GROUP_LABEL[m]).join(' · '),
  techniqueId: e.techniqueId,
  libraryId: e.id,
  fitsMyEquipment: e.fitsMyEquipment,
}));

/** Todas (para buscar ejercicios ya guardados en sesiones). */
export const ALL_OPTIONS: ExerciseOption[] = [...techOptions, ...libOptions];
/** Las que se ofrecen al añadir: solo biblioteca ilustrada. */
export const PICKABLE_OPTIONS: ExerciseOption[] = libOptions;

/** Rutina de bíceps y espalda del 17-11-2026 (sugerida arriba en el selector). */
export const FEATURED_IDS = [
  'ek-0211', // curl con barra
  'ek-0239', // curl predicador
  'ek-0253', // curl en máquina (supino)
  'ek-0223', // curl alterno en supinación
  'ek-0087', // dominadas
  'ek-9087', // dominadas asistidas (máquina)
  'ek-0024', // remo con mancuerna
  'ek-0025', // remo sentado en polea
  'ek-0097', // jalón al pecho agarre abierto
];

export function findOption(id: string): ExerciseOption | undefined {
  return ALL_OPTIONS.find((o) => o.ref.id === id);
}

export function searchOptions(query: string, onlyMine: boolean): ExerciseOption[] {
  const q = normalize(query.trim());
  return PICKABLE_OPTIONS.filter((o) => (!onlyMine || o.fitsMyEquipment) && (!q || normalize(o.ref.name).includes(q)));
}
