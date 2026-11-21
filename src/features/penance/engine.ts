/**
 * Penitencia por inactividad (lógica pura, por días locales «YYYY-MM-DD»). Acordado el 20-11-2026:
 * - Cuenta desde tu primera sesión. Una sesión = entrenamiento de pesas terminado (≥3 series).
 * - 5–6 días sin sesión: aviso. Día 7: misión de penitencia → 2 sesiones en los 7 días siguientes.
 * - Si la fallas: 1.ª vez pierdes la XP del nivel actual; 2.ª y siguientes, bajas 1 nivel (máx. 1 por semana).
 * - Cumplir la misión (2 sesiones en la ventana) la cierra y reinicia la cuenta.
 * - Modo descanso (hasta 14 días, enfermedad/lesión/viaje): esos días no cuentan y alargan la ventana.
 */
export const WARNING_DAY = 5;
export const PENANCE_DAY = 7;
export const WINDOW_DAYS = 7;
export const SESSIONS_NEEDED = 2;
export const MAX_REST_DAYS = 14;

export interface RestPeriod {
  start: string;
  /** Inclusive. */
  end: string;
}

export type PenanceEvent =
  | { kind: 'start'; date: string; windowStart: string }
  | { kind: 'fail_xp'; date: string; windowStart: string }
  | { kind: 'fail_level'; date: string; windowStart: string }
  | { kind: 'cleared'; date: string; windowStart: string };

export interface PenanceState {
  status: 'ok' | 'warning' | 'penance' | 'rest' | 'inactive';
  /** Días sin sesión contados (sin días de descanso). */
  daysInactive: number;
  window: { start: string; end: string; sessions: number; failures: number } | null;
  events: PenanceEvent[];
}

const DAY = 86_400_000;
export const addDays = (key: string, n: number) => new Date(Date.parse(`${key}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10);

export function isRestDay(key: string, rest: readonly RestPeriod[]): boolean {
  return rest.some((r) => key >= r.start && key <= r.end && addDays(r.start, MAX_REST_DAYS - 1) >= key);
}

export function evaluatePenance(sessionDays: readonly string[], rest: readonly RestPeriod[], today: string): PenanceState {
  const sessions = [...new Set(sessionDays)].filter((d) => d <= today).sort();
  if (sessions.length === 0) return { status: 'inactive', daysInactive: 0, window: null, events: [] };
  const has = new Set(sessions);
  const events: PenanceEvent[] = [];
  let inactive = 0;
  let window: { start: string; end: string; sessions: number; failures: number } | null = null;
  let failures = 0;

  for (let d = sessions[0]!; d <= today; d = addDays(d, 1)) {
    const trained = has.has(d);
    const resting = isRestDay(d, rest);
    if (window) {
      if (resting && !trained) window.end = addDays(window.end, 1); // el descanso pausa la ventana
      if (trained) window.sessions++;
      if (window.sessions >= SESSIONS_NEEDED) {
        events.push({ kind: 'cleared', date: d, windowStart: window.start });
        window = null;
        failures = 0;
        inactive = 0;
        continue;
      }
      if (d === window.end && d < today) {
        failures++;
        events.push({ kind: failures === 1 ? 'fail_xp' : 'fail_level', date: d, windowStart: window.start });
        const next = addDays(d, 1);
        window = { start: next, end: addDays(next, WINDOW_DAYS - 1), sessions: 0, failures };
        events.push({ kind: 'start', date: next, windowStart: next });
      }
      continue;
    }
    if (trained) {
      inactive = 0;
      continue;
    }
    if (resting) continue;
    inactive++;
    if (inactive >= PENANCE_DAY) {
      window = { start: d, end: addDays(d, WINDOW_DAYS - 1), sessions: 0, failures };
      events.push({ kind: 'start', date: d, windowStart: d });
    }
  }

  const restingToday = isRestDay(today, rest);
  const status: PenanceState['status'] = window
    ? 'penance'
    : restingToday
      ? 'rest'
      : inactive >= WARNING_DAY
        ? 'warning'
        : 'ok';
  return { status, daysInactive: inactive, window, events };
}

/** Daño del emblema: niveles por debajo del mínimo del rango (0 = intacto, máx. 3). */
export function badgeDamage(level: number, rankMinLevel: number): 0 | 1 | 2 | 3 {
  return Math.max(0, Math.min(3, rankMinLevel - level)) as 0 | 1 | 2 | 3;
}
