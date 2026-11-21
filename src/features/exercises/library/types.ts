/** Registro tal como lo genera scripts/import-everkinetic.py (texto original en inglés). */
export interface EverkineticRecord {
  id: string;
  slug: string;
  title: string;
  primer: string;
  type: string;
  primary: string[];
  secondary: string[];
  equipment: string[];
  steps: string[];
  tips: string[];
}

/** Traducción/adaptación al español. Solo `name` es obligatorio. */
export interface SpanishText {
  name: string;
  summary?: string;
  steps?: string[];
  tips?: string[];
}

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'core'
  | 'glutes'
  | 'quads'
  | 'hamstrings'
  | 'calves'
  | 'forearms'
  | 'neck';

export interface LibraryExercise {
  /** Id estable en la app: "ek-0054". Se usará como exercises.id en SQLite. */
  id: string;
  sourceId: string;
  name: string;
  nameEn: string;
  /** true cuando el texto mostrado es la adaptación al español. */
  translated: boolean;
  summary: string;
  steps: string[];
  tips: string[];
  primary: MuscleGroup[];
  secondary: MuscleGroup[];
  equipment: string[];
  /** Encaja con el equipamiento declarado del usuario. */
  fitsMyEquipment: boolean;
  /** null cuando no hay ilustración (ni propia ni de referencia). */
  images: [number, number] | null;
  /** Aviso cuando la ilustración es de un ejercicio parecido (no hay dibujo propio). */
  imageNote?: string;
  /** Zonas del mapa muscular. */
  primaryRegions: import('../bodyMap/regions').BodyRegion[];
  secondaryRegions: import('../bodyMap/regions').BodyRegion[];
  /** Cómo se calcula la carga: pesas, peso corporal (± lastre) o asistido (− asistencia). */
  loadMode: import('@/features/training/load').LoadMode;
  /** Cómo se registran sus series: repeticiones o tiempo (planchas). */
  measure: 'reps' | 'time';
  /** Máquina de palanca cargada con discos a ambos lados: se registra el total de discos. */
  plateLoading?: 'both-sides';
  /** Id de la animación de técnica propia (ExerciseTechnique), si existe. */
  techniqueId?: string;
}
