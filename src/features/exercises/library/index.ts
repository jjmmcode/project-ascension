import { EVERKINETIC } from './everkinetic.data';
import { EK_IMAGES } from './everkinetic.images';
import { ES } from './es';
import type { EverkineticRecord, LibraryExercise, MuscleGroup } from './types';
import { regionsFor, type BodyRegion } from '../bodyMap/regions';
import type { LoadMode } from '@/features/training/load';

export type { LibraryExercise, MuscleGroup } from './types';

/** Normaliza los nombres de músculo de Everkinetic (incluye sus erratas) a grupos de la app. */
const MUSCLE: Record<string, MuscleGroup> = {
  'pectoralis major': 'chest',
  'latissimus dorsi': 'back',
  trapezius: 'back',
  'erector spinae': 'back',
  back: 'back',
  'upper back': 'back',
  deltoid: 'shoulders',
  'deltoideus (clavicula)': 'shoulders',
  should: 'shoulders',
  'biceps brachii': 'biceps',
  bicpes: 'biceps',
  forearm: 'forearms',
  forerm: 'forearms',
  'triceps brachii': 'triceps',
  abdominals: 'core',
  obliques: 'core',
  core: 'core',
  'glutaeus maximus': 'glutes',
  'hip abductors': 'glutes',
  quadriceps: 'quads',
  'ischiocrural muscles': 'hamstrings',
  gastrocnemius: 'calves',
  soleus: 'calves',
};

export const MUSCLE_GROUP_LABEL: Record<MuscleGroup, string> = {
  chest: 'Pecho',
  back: 'Espalda',
  shoulders: 'Hombros',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  core: 'Core',
  glutes: 'Glúteos',
  quads: 'Cuádriceps',
  hamstrings: 'Isquiotibiales',
  calves: 'Pantorrillas',
  forearms: 'Antebrazos',
  neck: 'Cuello',
};

export const EQUIPMENT_LABEL: Record<string, string> = {
  body: 'Peso corporal',
  bar: 'Barra fija',
  'pull-up bar': 'Barra de dominadas',
  'wide bar': 'Barra ancha (polea)',
  'v-bar': 'Agarre en V (polea)',
  'parallel bars': 'Paralelas',
  dumbbell: 'Mancuerna',
  dumbbells: 'Mancuernas',
  barbell: 'Barra olímpica',
  bench: 'Banco',
  'flat bench': 'Banco plano',
  'bench: incline': 'Banco inclinado',
  'bench: decline': 'Banco declinado',
  'bench: hyperextension': 'Banco de hiperextensiones',
  cable: 'Polea',
  'exercise band': 'Banda elástica',
  towel: 'Toalla',
  weight: 'Peso libre',
  'weight plate': 'Disco',
  machine: 'Máquina',
  'machine: butterfly': 'Máquina de aperturas',
  'machine: bench press': 'Máquina de press',
  'machine: chest': 'Máquina de pecho',
  'chest machine': 'Máquina de pecho',
  'smith machine': 'Máquina Smith',
  't-bar machine': 'Barra T',
  'exercise ball': 'Pelota de ejercicio',
  'stability ball': 'Pelota de estabilidad',
  'swiss ball': 'Pelota suiza',
  'bosu ball': 'BOSU',
  'medicine ball': 'Balón medicinal',
  'balance board': 'Tabla de equilibrio',
};

/**
 * Equipamiento declarado en el documento del proyecto: mancuernas, banco, poleas,
 * paralelas y barra de dominadas. En la Etapa 3 se leerá de los ajustes del perfil.
 */
export const DEFAULT_MY_EQUIPMENT = new Set([
  'body', 'bar', 'pull-up bar', 'wide bar', 'v-bar', 'parallel bars', 'dumbbell', 'dumbbells',
  'bench', 'flat bench', 'bench: incline', 'bench: decline', 'cable', 'towel', 'weight', 'machine',
  'barbell', 'weight plate',
]);

/**
 * Ejercicios que mueven el 100 % del peso corporal: su carga efectiva es peso corporal + lastre.
 * (Como en Hevy, no se aplica a flexiones o abdominales, que mueven solo una parte del peso.)
 */
const BODYWEIGHT_IDS = new Set(['0054', '0087', '0090', '0091', '0162', '0172']);

/** Animaciones de figura de palitos: ocultas por ahora (el usuario prefiere las ilustraciones). */
export const SHOW_STICK_ANIMATIONS = false;

/** Ejercicios de la biblioteca que tienen además una animación de técnica propia. */
const TECHNIQUE_LINKS: Record<string, string> = {
  '0054': 'dips-chest',
  '0172': 'dips-triceps',
  '0077': 'pushup',
  '0188': 'pushup-close',
  '0087': 'pullup',
  '0091': 'pullup-wide',
  '0211': 'barbell-curl',
  '0239': 'preacher-curl',
  '0236': 'preacher-curl',
  '0223': 'alternating-curl',
  '0253': 'alternating-curl',
  '0024': 'dumbbell-row',
  '0025': 'seated-cable-row',
};

/** Neck: los dos ejercicios de cuello aparecen como trapecio en el original. */
const NECK_IDS = new Set(['0001', '0002']);

const unique = <T,>(xs: T[]) => [...new Set(xs)];

/**
 * Ejercicios que Everkinetic describe pero sin ilustración propia: se muestran con el dibujo
 * del ejercicio más parecido y un aviso.
 */
const core = (id: string, slug: string, title: string, primary: string[], secondary: string[]): EverkineticRecord => ({
  id, slug, title, primer: '', type: 'isolation', primary, secondary, equipment: ['body'], steps: [], tips: [],
});

/** Ejercicios que se registran por tiempo (segundos) en vez de repeticiones. */
const TIME_IDS = new Set(['0113', '9304']);

const EXTRA: Array<{ record: EverkineticRecord; imagesFrom: string | null; imageNote: string; loadMode?: LoadMode }> = [
  {
    record: {
      id: '9087',
      slug: 'assisted-pull-up-machine',
      title: 'Assisted Pull-Up (Machine)',
      primer: '',
      type: 'compound',
      primary: ['latissimus dorsi'],
      secondary: ['biceps brachii', 'trapezius', 'deltoid'],
      equipment: ['machine'],
      steps: [],
      tips: [],
    },
    imagesFrom: '0087',
    imageNote:
      'Ilustración de referencia: dominada libre. En la máquina apoyas las rodillas (o los pies) en la plataforma; el movimiento de brazos y espalda es el mismo.',
    loadMode: 'assisted',
  },
  {
    record: {
      id: '0097',
      slug: 'pull-down-wide-bar',
      title: 'Pull Down: Wide Bar (Wide Grip)',
      primer: 'This is an exercise for lats, biceps and middle back strengthening.',
      type: 'compound',
      primary: ['latissimus dorsi'],
      secondary: ['biceps brachii', 'trapezius'],
      equipment: ['cable', 'wide bar'],
      steps: [],
      tips: [],
    },
    imagesFrom: '0093',
    imageNote: 'Ilustración de referencia: jalón al pecho (el dibujo muestra un agarre más cerrado).',
  },
  // Core para el día de miércoles (Big 3 de McGill + complementos). Everkinetic no los dibuja.
  {
    record: core('9301', 'mcgill-curl-up', 'McGill Curl-Up', ['abdominals'], ['obliques']),
    imagesFrom: '0291',
    imageNote:
      'Ilustración de referencia: crunch. En el curl-up de McGill una pierna va estirada, las manos bajo la zona lumbar y solo despegas un poco cabeza y hombros.',
  },
  {
    record: core('9302', 'bird-dog', 'Bird Dog', ['erector spinae'], ['glutaeus maximus', 'abdominals', 'deltoid']),
    imagesFrom: null,
    imageNote: 'Sin ilustración en la biblioteca: guíate por los pasos y el mapa muscular.',
  },
  {
    record: core('9303', 'dead-bug', 'Dead Bug', ['abdominals'], ['obliques']),
    imagesFrom: '0287',
    imageNote:
      'Ilustración de referencia: elevación de cadera con rodillas flexionadas (misma posición de partida). En el dead bug extiendes un brazo y la pierna contraria sin despegar la zona lumbar.',
  },
  {
    record: core('9304', 'front-plank', 'Front Plank', ['abdominals'], ['obliques', 'glutaeus maximus', 'deltoid']),
    imagesFrom: '0113',
    imageNote: 'Ilustración de referencia: plancha lateral. En la frontal apoyas ambos antebrazos mirando al suelo.',
  },
  {
    record: core('9305', 'glute-bridge', 'Glute Bridge', ['glutaeus maximus'], ['ischiocrural muscles', 'erector spinae']),
    imagesFrom: null,
    imageNote: 'Sin ilustración en la biblioteca: guíate por los pasos y el mapa muscular.',
  },
  {
    record: { ...core('9306', 'wrist-curl-dumbbell', 'Wrist Curl: Dumbbell', ['forearm'], []), equipment: ['dumbbell', 'bench'] },
    imagesFrom: null,
    imageNote: 'Sin ilustración en la biblioteca: guíate por los pasos y el mapa muscular.',
  },
  // Pedidos por el usuario el 19-11-2026.
  {
    record: { ...core('9307', 'machine-shoulder-press-plates', 'Machine Shoulder Press (Plate Loaded)', ['deltoid'], ['triceps brachii']), equipment: ['machine', 'weight plate'] },
    imagesFrom: '0004',
    imageNote:
      'Ilustración de referencia: press militar con barra. En la máquina empujas dos asas por un recorrido fijo; anota el total de discos de ambos lados.',
  },
  {
    record: { ...core('9308', 'plate-front-raise', 'Plate Front Raise', ['deltoid'], ['pectoralis major']), equipment: ['weight plate'] },
    imagesFrom: '0033',
    imageNote: 'Ilustración de referencia: elevación frontal con mancuerna. Con disco lo sujetas con ambas manos por los lados (a las 3 y a las 9).',
  },
];

/**
 * Correcciones de músculos donde el original no coincide con la técnica adaptada
 * (p. ej. el remo a una mano con el codo hacia la cadera trabaja sobre todo el dorsal).
 */
const MUSCLE_OVERRIDES: Record<string, { primary: string[]; secondary: string[] }> = {
  '0024': { primary: ['latissimus dorsi'], secondary: ['trapezius', 'deltoid', 'biceps brachii'] },
  '0211': { primary: ['biceps brachii'], secondary: ['forearm'] },
  '0239': { primary: ['biceps brachii'], secondary: ['forearm'] },
  '0223': { primary: ['biceps brachii'], secondary: ['forearm'] },
  '0087': { primary: ['latissimus dorsi'], secondary: ['biceps brachii', 'trapezius', 'deltoid'] },
  '0025': { primary: ['latissimus dorsi', 'trapezius'], secondary: ['biceps brachii', 'deltoid'] },
  '0253': { primary: ['biceps brachii'], secondary: ['forearm'] },
  // Curl inverso: el principal es el braquiorradial (antebrazo).
  '0257': { primary: ['forearm'], secondary: ['biceps brachii'] },
  // Extensión sobre la cabeza: lo describe Everkinetic como "press", pero es una extensión de tríceps.
  '0194': { primary: ['triceps brachii'], secondary: [] },
  // Peso muerto rumano: isquios y glúteo como principales, erectores como estabilizadores.
  '0118': { primary: ['ischiocrural muscles', 'glutaeus maximus'], secondary: ['erector spinae'] },
  '0127': { primary: ['quadriceps', 'glutaeus maximus'], secondary: ['ischiocrural muscles'] },
  '0121': { primary: ['quadriceps', 'glutaeus maximus'], secondary: ['ischiocrural muscles'] },
};

function build(myEquipment: Set<string>): LibraryExercise[] {
  const records: Array<{ r: EverkineticRecord; images: [number, number] | null; imageNote?: string; loadMode?: LoadMode }> = [
    ...EVERKINETIC.map((r) => ({ r, images: EK_IMAGES[r.id]! })),
    ...EXTRA.map((x) => ({ r: x.record, images: x.imagesFrom ? EK_IMAGES[x.imagesFrom]! : null, imageNote: x.imageNote, loadMode: x.loadMode })),
  ];
  return records.map(({ r: original, images, imageNote, loadMode }) => {
    const r = MUSCLE_OVERRIDES[original.id] ? { ...original, ...MUSCLE_OVERRIDES[original.id] } : original;
    const es = ES[r.id];
    const translated = !!es?.steps?.length;
    const primary = NECK_IDS.has(r.id) ? (['neck'] as MuscleGroup[]) : unique(r.primary.map((m) => MUSCLE[m]).filter((m): m is MuscleGroup => !!m));
    const secondary = unique(r.secondary.map((m) => MUSCLE[m]).filter((m): m is MuscleGroup => !!m && !primary.includes(m)));
    const primaryRegions: BodyRegion[] = NECK_IDS.has(r.id) ? ['neck'] : regionsFor(r.primary);
    const secondaryRegions = regionsFor(r.secondary).filter((x) => !primaryRegions.includes(x));
    return {
      id: `ek-${r.id}`,
      sourceId: r.id,
      name: es?.name ?? r.title,
      nameEn: r.title,
      translated,
      summary: translated ? (es?.summary ?? '') : r.primer,
      steps: translated ? es!.steps! : r.steps,
      tips: translated ? (es?.tips ?? []) : r.tips,
      primary,
      secondary,
      equipment: r.equipment,
      fitsMyEquipment: r.equipment.every((e) => myEquipment.has(e)),
      images,
      imageNote,
      loadMode: loadMode ?? (BODYWEIGHT_IDS.has(r.id) ? 'bodyweight' : 'external'),
      primaryRegions,
      secondaryRegions,
      techniqueId: TECHNIQUE_LINKS[r.id],
      measure: TIME_IDS.has(r.id) ? 'time' : 'reps',
      ...(r.id === '9307' ? { plateLoading: 'both-sides' as const } : {}),
    };
  });
}

export const LIBRARY: LibraryExercise[] = build(DEFAULT_MY_EQUIPMENT).sort((a, b) => a.name.localeCompare(b.name, 'es'));

export const getLibraryExercise = (id: string) => LIBRARY.find((e) => e.id === id) ?? null;

/** Búsqueda sin tildes ni mayúsculas, en el nombre en español y en el original en inglés. */
export const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export function searchLibrary(query: string, opts: { muscle?: MuscleGroup | null; onlyMine?: boolean } = {}): LibraryExercise[] {
  const q = normalize(query.trim());
  return LIBRARY.filter(
    (e) =>
      (!opts.onlyMine || e.fitsMyEquipment) &&
      (!opts.muscle || e.primary.includes(opts.muscle)) &&
      (!q || normalize(e.name).includes(q) || normalize(e.nameEn).includes(q)),
  );
}
