import {
  levelFromXp,
  rankForLevel,
  totalXpForLevel,
  xpToNext,
  MAX_LEVEL,
} from '@/features/progression/leveling';

describe('curva de progresión', () => {
  it('estado inicial: nivel 1, rango E, 0 XP', () => {
    const s = levelFromXp(0);
    expect(s).toMatchObject({ level: 1, rank: 'E', totalXp: 0, xpIntoLevel: 0, xpForNext: 100 });
    expect(s.progress).toBe(0);
  });

  it('valores documentados de xpToNext', () => {
    expect(xpToNext(1)).toBe(100);
    expect(xpToNext(2)).toBe(280);
    expect(xpToNext(5)).toBe(1120);
    expect(xpToNext(10)).toBe(3160);
  });

  it('la XP requerida crece estrictamente', () => {
    for (let l = 1; l < MAX_LEVEL - 1; l++) {
      expect(xpToNext(l + 1)).toBeGreaterThan(xpToNext(l));
    }
  });

  it('sube de nivel exactamente en el umbral', () => {
    expect(levelFromXp(99).level).toBe(1);
    expect(levelFromXp(100).level).toBe(2);
    expect(levelFromXp(100).xpIntoLevel).toBe(0);
    expect(levelFromXp(totalXpForLevel(10)).level).toBe(10);
    expect(levelFromXp(totalXpForLevel(10) - 1).level).toBe(9);
  });

  it('rangos por nivel', () => {
    expect(rankForLevel(1)).toBe('E');
    expect(rankForLevel(9)).toBe('E');
    expect(rankForLevel(10)).toBe('D');
    expect(rankForLevel(20)).toBe('C');
    expect(rankForLevel(30)).toBe('B');
    expect(rankForLevel(45)).toBe('A');
    expect(rankForLevel(60)).toBe('S');
    expect(rankForLevel(75)).toBe('SS');
    expect(rankForLevel(90)).toBe('SSS');
    expect(rankForLevel(100)).toBe('SSS+');
  });

  it('respeta el nivel máximo', () => {
    const s = levelFromXp(1e12);
    expect(s.level).toBe(MAX_LEVEL);
    expect(s.progress).toBe(1);
  });

  it('rechaza entradas inválidas', () => {
    expect(() => levelFromXp(-1)).toThrow(RangeError);
    expect(() => levelFromXp(Number.NaN)).toThrow(RangeError);
    expect(() => xpToNext(0)).toThrow(RangeError);
  });
});
