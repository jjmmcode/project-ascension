export const DEFAULT_TIMEZONE = 'America/Santiago';

export const nowIso = (): string => new Date().toISOString();

/**
 * Clave de día local `YYYY-MM-DD` en la zona horaria indicada.
 * Ej.: 2026-11-18T02:30Z en Santiago (UTC-3) → "2026-11-17".
 */
export function localDateKey(date: Date = new Date(), timeZone: string = DEFAULT_TIMEZONE): string {
  try {
    return intlDateKey(date, timeZone);
  } catch {
    // Respaldo: fecha local del dispositivo (configurado en la misma zona del usuario).
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }
}

function intlDateKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const key = `${get('year')}-${get('month')}-${get('day')}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) throw new Error('Intl sin soporte de formatToParts');
  return key;
}

/** Fecha legible en español: "28 may 2026". */
export function formatShortDate(iso: string, timeZone: string = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat('es-CL', { timeZone, day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(iso))
    .replace('.', '');
}

/** Lunes (YYYY-MM-DD, hora local) de la semana ISO de la fecha. */
export function isoWeekStart(date: Date = new Date()): string {
  const key = localDateKey(date);
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  const local = new Date(Date.UTC(y, m - 1, d));
  const dow = (local.getUTCDay() + 6) % 7; // 0 = lunes
  local.setUTCDate(local.getUTCDate() - dow);
  return local.toISOString().slice(0, 10);
}
