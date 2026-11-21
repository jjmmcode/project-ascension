/**
 * @jest-environment node
 */
import { localDateKey } from '@/lib/time';
import { parseDecimal } from '@/lib/numbers';

describe('localDateKey', () => {
  it('usa el día de Santiago, no el UTC', () => {
    // 02:30 UTC del 18 = 23:30 del 17 en Santiago (UTC-3 en verano)
    expect(localDateKey(new Date('2026-11-18T02:30:00Z'), 'America/Santiago')).toBe('2026-11-17');
    expect(localDateKey(new Date('2026-11-18T03:30:00Z'), 'America/Santiago')).toBe('2026-11-18');
  });
});

describe('parseDecimal', () => {
  it('acepta coma y punto', () => {
    expect(parseDecimal('72,5')).toBe(72.5);
    expect(parseDecimal(' 180 ')).toBe(180);
    expect(parseDecimal('72.5')).toBe(72.5);
  });
  it('punto como separador de miles (es-CL)', () => {
    expect(parseDecimal('2.000')).toBe(2000);
    expect(parseDecimal('2.513')).toBe(2513);
    expect(parseDecimal('2.000,5')).toBe(2000.5);
  });
  it('vacío → null, basura → NaN', () => {
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('abc')).toBeNaN();
    expect(parseDecimal('1,2,3')).toBeNaN();
  });
});
