/**
 * Design tokens de Project Ascension.
 * Única fuente de verdad para colores, espaciado, radios y tipografía.
 */

export const colors = {
  bg: '#080B14',
  bgElevated: '#111827',
  surface: '#172338',
  surfaceHigh: '#1E2D47',
  border: 'rgba(148, 163, 184, 0.14)',
  borderStrong: 'rgba(59, 130, 246, 0.45)',

  primary: '#3B82F6',
  violet: '#8B5CF6',
  cyan: '#22D3EE',

  text: '#F8FAFC',
  textMuted: '#94A3B8',
  textFaint: '#64748B',

  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',

  // Acentos por módulo (identidad visual consistente en toda la app)
  module: {
    training: '#3B82F6',
    nutrition: '#F59E0B',
    hydration: '#22D3EE',
    quests: '#8B5CF6',
    evolution: '#22C55E',
  },
} as const;

/** Colores asociados a cada rango RPG. */
export const rankColors = {
  E: '#94A3B8',
  D: '#22C55E',
  C: '#22D3EE',
  B: '#3B82F6',
  A: '#8B5CF6',
  S: '#F59E0B',
  SS: '#EF4444',
  SSS: '#FDE047',
  'SSS+': '#F0ABFC',
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 32, fontWeight: '800', letterSpacing: 0.5 },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: 0.3 },
  heading: { fontSize: 17, fontWeight: '700' },
  body: { fontSize: 15, fontWeight: '400' },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase' },
  caption: { fontSize: 12, fontWeight: '400' },
  numeric: { fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'] },
} as const;

/** Tamaño mínimo de área táctil recomendado por Material/Android. */
export const MIN_TOUCH = 48;
