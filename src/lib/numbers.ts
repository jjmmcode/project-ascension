/**
 * Convierte texto del usuario a número con convenciones chilenas:
 *   "72,5" → 72.5   ·   "2.000" → 2000   ·   "2.000,5" → 2000.5   ·   "72.5" → 72.5
 * Un punto seguido de grupos de exactamente 3 dígitos se interpreta como separador de miles.
 * Devuelve `null` si está vacío y `NaN` si no es un número válido.
 */
export function parseDecimal(input: string): number | null {
  let s = input.trim().replace(/\s/g, '');
  if (s === '') return null;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '');
  s = s.replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return Number.NaN;
  return Number(s);
}

export const formatNumber = (n: number, maxDecimals = 1): string =>
  n.toLocaleString('es-CL', { maximumFractionDigits: maxDecimals });
