/**
 * @jest-environment node
 */
import { distanceKm, netKcal, outsideValidRange, suggestedMode, vo2 } from '@/features/cardio/acsm';
import { createTestDb } from './helpers/nodeDb';
import { migrate, profilesRepo } from '@/database';
import { bodyMetricsRepo } from '@/database/repositories/bodyMetrics';
import { cardioMinutes7d, fitiaLine, listCardio, logCardio } from '@/services/cardio';
import { totalXp } from '@/services/xp';
import { computeAttributes, type AttributeInput } from '@/features/attributes/engine';
import { totalXpForLevel } from '@/features/progression/leveling';
import { exportBackup } from '@/services/backup';

describe('ecuaciones ACSM', () => {
  it('caminar 6 km/h al 8 %: VO2 27,9 y ≈293 kcal netas en 30 min con 80 kg', () => {
    expect(vo2('walk', 6, 8)).toBeCloseTo(27.9, 5);
    expect(netKcal({ mode: 'walk', speedKmh: 6, inclinePct: 8, minutes: 30, weightKg: 80 })).toBeCloseTo(292.8, 1);
  });

  it('correr 10 km/h plano: 350 kcal netas en 30 min con 70 kg', () => {
    expect(netKcal({ mode: 'run', speedKmh: 10, inclinePct: 0, minutes: 30, weightKg: 70 })).toBeCloseTo(350, 0);
  });

  it('la inclinación cuesta más caminando que corriendo (1,8 vs 0,9)', () => {
    const walk = vo2('walk', 5, 10) - vo2('walk', 5, 0);
    const run = vo2('run', 5, 10) - vo2('run', 5, 0);
    expect(walk).toBeCloseTo(run * 2, 5);
  });

  it('modo sugerido, rango válido y distancia', () => {
    expect(suggestedMode(5.5)).toBe('walk');
    expect(suggestedMode(9)).toBe('run');
    expect(outsideValidRange('walk', 5)).toBe(false);
    expect(outsideValidRange('walk', 7.5)).toBe(true);
    expect(distanceKm(6, 30)).toBe(3);
  });
});

describe('sesiones de caminadora', () => {
  it('guarda kcal con el peso, da XP una vez al día y suma minutos de 7 días', async () => {
    const db = createTestDb();
    await migrate(db);
    const profileId = (await profilesRepo.create(db, { displayName: 'Test', heightCm: 175 })).id;
    const now = new Date('2026-11-21T15:00:00Z');
    // sin peso confirmado: no se inventan kcal
    const a = await logCardio(db, profileId, { mode: 'walk', speedKmh: 6, inclinePct: 8, minutes: 30 }, now);
    expect(a.session.kcal).toBeNull();
    expect(a.xp.awarded).toBe(50);
    await bodyMetricsRepo.create(db, profileId, { measuredAt: now.toISOString(), weightKg: 80, source: 'manual' });
    const b = await logCardio(db, profileId, { mode: 'walk', speedKmh: 6, inclinePct: 8, minutes: 30 }, new Date(now.getTime() + 3600_000));
    expect(b.session.kcal).toBe(293);
    expect(b.xp).toMatchObject({ awarded: 0, reason: 'daily_cap' });
    expect(await totalXp(db, profileId)).toBe(50);
    // < 10 min no da XP (otro día)
    const c = await logCardio(db, profileId, { mode: 'run', speedKmh: 9, inclinePct: 0, minutes: 8 }, new Date(now.getTime() + 86_400_000));
    expect(c.xp.awarded).toBe(0);
    expect(await cardioMinutes7d(db, profileId, new Date(now.getTime() + 2 * 86_400_000))).toBe(68);
    expect((await listCardio(db, profileId)).length).toBe(3);
    expect(fitiaLine(b.session)).toBe('Caminata en cinta · 30 min · 6 km/h · 8 % · 293 kcal');
    // va en la copia de seguridad
    expect((await exportBackup(db, now)).tables.cardio_sessions?.length).toBe(3);
    await expect(logCardio(db, profileId, { mode: 'walk', speedKmh: 40, inclinePct: 0, minutes: 30 }, now)).rejects.toThrow();
    db.close();
  });
});

describe('atributo RES', () => {
  const base = (cardio: AttributeInput['cardio'], now: string): AttributeInput => ({
    xpEvents: [{ amount: totalXpForLevel(2), at: '2026-11-10T20:00:00.000Z' }],
    workouts: [],
    gymDays: [],
    bodyweightKg: null,
    now: new Date(now),
    cardio,
  });

  it('sesiones de ≥20 min y 150 min semanales dan RES; se duerme a las 6 semanas sin cardio', () => {
    const cardio = [
      { at: '2026-11-03T10:00:00.000Z', minutes: 60, speedKmh: 6, inclinePct: 8 },
      { at: '2026-11-05T10:00:00.000Z', minutes: 60, speedKmh: 6, inclinePct: 8 },
      { at: '2026-11-07T10:00:00.000Z', minutes: 40, speedKmh: 5.5, inclinePct: 10 },
    ];
    const s = computeAttributes(base(cardio, '2026-11-12T00:00:00.000Z'));
    expect(s.values.RES).toBe(3); // 4 hechos de RES para los 3 puntos del nivel 2
    expect(s.points.find((p) => p.attr === 'RES' && p.kind === 'cardio_week')?.reason).toBe('150 min de cardio en la semana');
    const later = computeAttributes(base(cardio, '2026-12-25T00:00:00.000Z'));
    expect(later.values.RES).toBe(0);
    expect(later.points.find((p) => p.attr === 'RES')?.recover).toBe('vuelve a la caminadora para recuperarlo');
  });
});
