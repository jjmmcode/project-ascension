/**
 * Mapa muscular propio (vista frontal y posterior), lógica pura y sin React.
 * Coordenadas en un lienzo de 200 × 220: figura frontal centrada en x = 50, posterior en x = 150.
 */

export type BodyRegion =
  | 'neck'
  | 'traps'
  | 'shoulders'
  | 'chest'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'obliques'
  | 'lats'
  | 'lowerBack'
  | 'glutes'
  | 'quads'
  | 'hamstrings'
  | 'calves';

export const REGION_LABEL: Record<BodyRegion, string> = {
  neck: 'Cuello',
  traps: 'Trapecio',
  shoulders: 'Hombros',
  chest: 'Pecho',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  forearms: 'Antebrazos',
  abs: 'Abdomen',
  obliques: 'Oblicuos',
  lats: 'Dorsales',
  lowerBack: 'Lumbar',
  glutes: 'Glúteos',
  quads: 'Cuádriceps',
  hamstrings: 'Isquiotibiales',
  calves: 'Gemelos',
};

/** Refleja un path horizontalmente respecto de x = cx (para generar el lado derecho). */
function mirror(d: string, cx: number): string {
  // Los paths de este archivo solo usan comandos absolutos M, L, Q, C, Z con pares x,y.
  return d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_, x: string, y: string) => `${+(2 * cx - Number(x)).toFixed(2)},${y}`);
}
const pair = (d: string, cx: number) => [d, mirror(d, cx)];

const F = 50; // eje de la figura frontal
const B = 150; // eje de la figura posterior

/** Silueta base: se dibuja debajo de los músculos. */
export const SILHOUETTE: string[] = [
  // Frontal
  'M50,5 C57,5 61,10 61,17 C61,24 57,29 50,29 C43,29 39,24 39,17 C39,10 43,5 50,5 Z',
  ...pair('M50,30 L44,31 L32,37 C26,39 23,44 22,52 L18,78 L14,104 L19,106 L26,80 L31,60 L34,66 L34,100 L36,112 L34,140 L35,160 L34,196 L44,198 L45,160 L47,124 L50,112 Z', F),
  // Posterior
  'M150,5 C157,5 161,10 161,17 C161,24 157,29 150,29 C143,29 139,24 139,17 C139,10 143,5 150,5 Z',
  ...pair('M150,30 L144,31 L132,37 C126,39 123,44 122,52 L118,78 L114,104 L119,106 L126,80 L131,60 L134,66 L134,100 L136,112 L134,140 L135,160 L134,196 L144,198 L145,160 L147,124 L150,112 Z', B),
];

/** Zonas musculares (cada una puede tener varias piezas). */
export const REGION_PATHS: Record<BodyRegion, string[]> = {
  neck: ['M46,28 L54,28 L55,34 L45,34 Z'],
  traps: [
    ...pair('M46,32 L37,37 L45,38 Z', F),
    'M150,29 L138,37 L143,44 L150,64 L157,44 L162,37 Z',
  ],
  shoulders: [
    ...pair('M36,37 C29,38 25,43 25,51 C28,49 32,47 36,46 Z', F),
    ...pair('M136,37 C129,38 125,43 125,51 C128,49 132,47 136,46 Z', B),
  ],
  chest: pair('M49,39 L37,40 C33,44 33,52 36,57 C40,61 46,61 49,58 Z', F),
  biceps: pair('M30,52 C26,55 24,62 25,70 C27,73 30,72 31,69 C32,63 32,57 30,52 Z', F),
  triceps: pair('M130,52 C126,55 124,62 125,70 C127,73 130,72 131,69 C132,63 132,57 130,52 Z', B),
  forearms: [
    ...pair('M25,74 C22,80 19,90 18,100 L21,101 C24,92 27,83 28,75 Z', F),
    ...pair('M125,74 C122,80 119,90 118,100 L121,101 C124,92 127,83 128,75 Z', B),
  ],
  abs: ['M44,62 L56,62 L56.5,98 C54,102 46,102 43.5,98 Z'],
  obliques: pair('M42,63 L37,62 C35,72 35,86 38,98 L42.5,97 Z', F),
  lats: pair('M143,45 C137,46 134,50 135,58 C136,68 140,78 146,84 L147,64 Z', B),
  lowerBack: ['M144,84 L156,84 L157,100 L143,100 Z'],
  glutes: pair('M149,101 L139,102 C136,108 137,118 143,121 C147,122 149,118 149,113 Z', B),
  quads: pair('M47,112 L37,113 C35,124 35,140 38,152 C41,156 45,154 46,148 C47,136 48,124 47,112 Z', F),
  hamstrings: pair('M148,123 L138,124 C136,134 136,146 138,156 C141,158 145,157 146,152 C147,142 148,132 148,123 Z', B),
  calves: [
    ...pair('M37,162 C35,170 35,180 37,188 L41,189 C42,180 42,170 41,162 Z', F),
    ...pair('M138,160 C135,168 135,180 138,190 L143,190 C144,180 144,168 142,160 Z', B),
  ],
};

export type RegionLevel = 'primary' | 'secondary';

export const BODY_MAP_STYLE = {
  silhouette: '#152036',
  silhouetteStroke: 'rgba(148,163,184,0.35)',
  idle: '#1E2D47',
  idleStroke: 'rgba(148,163,184,0.25)',
  primary: '#8B5CF6',
  secondary: 'rgba(139,92,246,0.42)',
  glow: 'rgba(139,92,246,0.35)',
} as const;

/** Mapea los nombres de músculo de Everkinetic (incluidas sus erratas) a zonas del mapa. */
export const EK_MUSCLE_REGIONS: Record<string, BodyRegion[]> = {
  'pectoralis major': ['chest'],
  'latissimus dorsi': ['lats'],
  trapezius: ['traps'],
  'upper back': ['traps'],
  back: ['lats'],
  'erector spinae': ['lowerBack'],
  deltoid: ['shoulders'],
  'deltoideus (clavicula)': ['shoulders'],
  should: ['shoulders'],
  'biceps brachii': ['biceps'],
  bicpes: ['biceps'],
  forearm: ['forearms'],
  forerm: ['forearms'],
  'triceps brachii': ['triceps'],
  abdominals: ['abs'],
  obliques: ['obliques'],
  core: ['abs', 'obliques'],
  'glutaeus maximus': ['glutes'],
  'hip abductors': ['glutes'],
  quadriceps: ['quads'],
  'ischiocrural muscles': ['hamstrings'],
  gastrocnemius: ['calves'],
  soleus: ['calves'],
};

export function regionsFor(muscles: string[]): BodyRegion[] {
  return [...new Set(muscles.flatMap((m) => EK_MUSCLE_REGIONS[m] ?? []))];
}

/** SVG en texto, para la vista previa en pruebas (la app usa el componente equivalente). */
export function bodyMapSvg(primary: BodyRegion[], secondary: BodyRegion[], scale = 2): string {
  const S = BODY_MAP_STYLE;
  const level = (r: BodyRegion): RegionLevel | null => (primary.includes(r) ? 'primary' : secondary.includes(r) ? 'secondary' : null);
  const sil = SILHOUETTE.map((d) => `<path d="${d}" fill="${S.silhouette}" stroke="${S.silhouetteStroke}" stroke-width="0.8"/>`).join('');
  const regs = (Object.keys(REGION_PATHS) as BodyRegion[])
    .flatMap((r) =>
      REGION_PATHS[r].map((d) => {
        const l = level(r);
        const fill = l === 'primary' ? S.primary : l === 'secondary' ? S.secondary : S.idle;
        const glow = l === 'primary' ? `<path d="${d}" fill="none" stroke="${S.glow}" stroke-width="4"/>` : '';
        return `${glow}<path d="${d}" fill="${fill}" stroke="${l ? S.primary : S.idleStroke}" stroke-width="0.6"/>`;
      }),
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${200 * scale}" height="${210 * scale}" viewBox="0 0 200 210"><rect width="200" height="210" fill="#0B1020"/>${sil}${regs}</svg>`;
}
