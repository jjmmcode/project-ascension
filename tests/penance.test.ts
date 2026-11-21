/**
 * @jest-environment node
 */
import { addDays, badgeDamage, evaluatePenance } from '@/features/penance/engine';
import { createTestDb } from './helpers/nodeDb';
import { migrate, profilesRepo } from '@/database';
import { workoutsRepo } from '@/database/repositories/workouts';
import { templatesRepo } from '@/database/repositories/templates';
import { ensureDefaultPlan, startFromTemplate } from '@/services/plan';
import { finishWorkout } from '@/services/workoutSession';
import { applyPenance, endRest, penaltyAmount, restPeriods, simulatePenance, startRest } from '@/services/penance';
import { awardXp, totalXp } from '@/services/xp';
import { levelFromXp, totalXpForLevel } from '@/features/progression/leveling';
import { computeAttributes } from '@/features/attributes/engine';
import { loadAttributeInput } from '@/services/attributes';

const D0 = '2026-11-02'; // lunes
const d = (n: number) => addDays(D0, n);

describe('motor de penitencia', () => {
  it('aviso a los 5 días, misión al 7.º', () => {
    expect(evaluatePenance([D0], [], d(4)).status).toBe('ok');
    expect(evaluatePenance([D0], [], d(5))).toMatchObject({ status: 'warning', daysInactive: 5 });
    const p = evaluatePenance([D0], [], d(7));
    expect(p.status).toBe('penance');
    expect(p.window).toMatchObject({ start: d(7), end: d(13), sessions: 0 });
  });

  it('2 sesiones en la ventana la cierran; 1 no basta', () => {
    expect(evaluatePenance([D0, d(9)], [], d(12)).window?.sessions).toBe(1);
    const ok = evaluatePenance([D0, d(9), d(11)], [], d(12));
    expect(ok.status).toBe('ok');
    expect(ok.events.map((e) => e.kind)).toEqual(['start', 'cleared']);
  });

  it('fallos: 1.º pierde la XP del nivel, luego −1 nivel por semana', () => {
    const r = evaluatePenance([D0], [], d(28));
    expect(r.events.filter((e) => e.kind !== 'start').map((e) => [e.kind, e.date])).toEqual([
      ['fail_xp', d(13)],
      ['fail_level', d(20)],
      ['fail_level', d(27)],
    ]);
    // El día del vencimiento todavía puedes cumplir
    expect(evaluatePenance([D0], [], d(13)).events.some((e) => e.kind === 'fail_xp')).toBe(false);
  });

  it('el modo descanso pausa la cuenta y alarga la ventana', () => {
    const rest = [{ start: d(2), end: d(15) }];
    expect(evaluatePenance([D0], rest, d(15)).status).toBe('rest');
    expect(evaluatePenance([D0], rest, d(16)).daysInactive).toBe(2); // días 1 y 16
    // descanso que empieza dentro de una penitencia: la ventana se alarga
    const r = evaluatePenance([D0], [{ start: d(9), end: d(11) }], d(16));
    expect(r.window).toMatchObject({ start: d(7), end: d(16) });
  });

  it('daño del emblema según niveles bajo el mínimo del rango', () => {
    expect([10, 9, 8, 7, 3].map((l) => badgeDamage(l, 10))).toEqual([0, 1, 2, 3, 3]);
  });
});

describe('servicio de penitencia', () => {
  it('aplica los fallos una sola vez, baja el nivel, quita sus puntos y da XP doble al volver', async () => {
    const db = createTestDb();
    await migrate(db);
    const profileId = (await profilesRepo.create(db, { displayName: 'P', heightCm: 175 })).id;
    await ensureDefaultPlan(db, profileId);
    // Nivel 4 a base de XP de días anteriores
    for (let i = 0; (await totalXp(db, profileId)) < totalXpForLevel(4) + 200; i++) {
      await awardXp(db, { profileId, source: 'workout', sourceId: `x${i}`, idempotencyKey: `x${i}`, at: new Date(Date.UTC(2026, 9, 1 + i)) });
    }
    const t = (await templatesRepo.list(db, profileId))[0]!;
    const w = await startFromTemplate(db, profileId, t.id);
    for (const s of (await workoutsRepo.listSets(db, w.id)).slice(0, 3)) await workoutsRepo.updateSet(db, s.id, { repetitions: 10, weightKg: 20, completed: true });
    await db.runAsync(`UPDATE workouts SET started_at = ? WHERE id = ?`, [`${D0}T15:00:00.000Z`, w.id]);
    await finishWorkout(db, w.id, new Date(`${D0}T16:00:00.000Z`));
    await db.runAsync(`UPDATE workouts SET started_at = ? WHERE id = ?`, [`${D0}T15:00:00.000Z`, w.id]);
    const levelBefore = levelFromXp(await totalXp(db, profileId)).level;

    const sim = await simulatePenance(db, profileId, 0, new Date(`${d(21)}T15:00:00Z`));
    expect(sim.pending.map((p) => p.event.kind)).toEqual(['fail_xp', 'fail_level']);
    expect(sim.levelThen).toBe(levelBefore - 1);
    expect(await totalXp(db, profileId)).toBeGreaterThan(sim.xpThen); // el simulador no toca nada

    const snap = await applyPenance(db, profileId, new Date(`${d(21)}T15:00:00Z`));
    expect(snap.applied.map((a) => a.kind)).toEqual(['fail_xp', 'fail_level']);
    expect(snap.level).toBe(levelBefore - 1);
    expect(snap.comeback).toBe(true);
    expect((await applyPenance(db, profileId, new Date(`${d(21)}T15:00:00Z`))).applied).toEqual([]);

    const attrs = computeAttributes(await loadAttributeInput(db, profileId, new Date(`${d(21)}T16:00:00Z`)));
    expect(attrs.points.filter((p) => p.level === levelBefore).every((p) => !p.active && p.recover === `recupera el nivel ${levelBefore}`)).toBe(true);

    // Volver: la sesión da XP doble
    const w2 = await startFromTemplate(db, profileId, t.id);
    for (const s of (await workoutsRepo.listSets(db, w2.id)).slice(0, 3)) await workoutsRepo.updateSet(db, s.id, { repetitions: 10, weightKg: 20, completed: true });
    const r = await finishWorkout(db, w2.id, new Date(`${d(22)}T16:00:00.000Z`));
    expect(r.comebackXp).toBe(100);
    db.close();
  });

  it('cantidades de penalización', () => {
    const t3 = totalXpForLevel(3);
    expect(penaltyAmount('fail_xp', t3 + 50)).toBe(50);
    expect(penaltyAmount('fail_level', t3 + 50)).toBe(t3 + 50 - totalXpForLevel(2));
    expect(penaltyAmount('fail_level', 40)).toBe(40);
  });

  it('modo descanso: iniciar y terminar', async () => {
    const db = createTestDb();
    await migrate(db);
    const profileId = (await profilesRepo.create(db, { displayName: 'P', heightCm: 175 })).id;
    const now = new Date(`${D0}T15:00:00Z`);
    const p = await startRest(db, profileId, now);
    expect(p).toEqual({ start: D0, end: d(13) });
    await endRest(db, profileId, new Date(`${d(3)}T15:00:00Z`));
    expect(await restPeriods(db, profileId)).toEqual([{ start: D0, end: d(2) }]);
    db.close();
  });
});
