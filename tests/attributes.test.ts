/**
 * @jest-environment node
 */
import { createTestDb } from './helpers/nodeDb';
import { migrate, profilesRepo } from '@/database';
import { bodyMetricsRepo } from '@/database/repositories/bodyMetrics';
import { workoutsRepo } from '@/database/repositories/workouts';
import { templatesRepo } from '@/database/repositories/templates';
import { ensureDefaultPlan, startFromTemplate } from '@/services/plan';
import { finishWorkout } from '@/services/workoutSession';
import { computeAttributesView, loadAttributeInput, musclesAtRisk } from '@/services/attributes';
import {
  activityEvents,
  allocatePoints,
  computeAttributes,
  levelTimeline,
  recoveredPoints,
  type AttributeInput,
  type HistoryWorkout,
} from '@/features/attributes/engine';
import { getLibraryExercise } from '@/features/exercises/library';
import { totalXpForLevel } from '@/features/progression/leveling';

const D = 86_400_000;
const base = Date.parse('2026-09-01T22:00:00Z');
const day = (n: number) => new Date(base + n * D).toISOString();

function workout(n: number, items: Array<[string, number, number, number?]>, templateName: string | null = 'Pecho y tríceps'): HistoryWorkout {
  return {
    id: `w${n}`,
    startedAt: day(n),
    templateName,
    sets: items.flatMap(([id, kg, reps, count = 1]) =>
      Array.from({ length: count }, () => ({
        libraryId: id,
        exerciseName: getLibraryExercise(id)!.name,
        primary: getLibraryExercise(id)!.primary,
        performedAt: day(n),
        completed: true,
        repetitions: reps,
        effectiveKg: kg,
        durationSeconds: null,
      })),
    ),
  };
}

const xpAt = (n: number, amount: number) => ({ amount, at: new Date(base + n * D + 3600_000).toISOString() });

describe('motor de atributos', () => {
  it('línea de tiempo de niveles según la XP', () => {
    const t = levelTimeline([xpAt(0, 25), xpAt(1, 25), xpAt(2, 50), xpAt(3, 50)]);
    expect(totalXpForLevel(2)).toBe(50);
    expect(totalXpForLevel(3)).toBe(150);
    expect([...t.keys()]).toEqual([2, 3]);
    expect(t.get(2)).toBe(xpAt(1, 0).at);
    expect(t.get(3)).toBe(xpAt(3, 0).at);
  });

  it('detecta récords, subidas de rank, volumen semanal, core y disciplina', () => {
    const input: AttributeInput = {
      xpEvents: [],
      workouts: [
        workout(0, [['ek-0042', 60, 8, 4]]),
        workout(2, [['ek-0042', 80, 8, 4], ['ek-0061', 20, 12, 6]]),
        workout(3, [['ek-9304', 0, 0, 3]], 'Core y zona lumbar'),
      ],
      gymDays: [1, 2, 4, 5],
      bodyweightKg: 84,
      now: new Date(base + 10 * D),
    };
    input.workouts[2]!.sets.forEach((s) => ((s.repetitions = null), (s.effectiveKg = null), (s.durationSeconds = 40)));
    const ev = activityEvents(input);
    const kinds = ev.map((e) => `${e.attr}:${e.kind}${e.muscle ? ':' + e.muscle : ''}`);
    expect(kinds).toContain('FUE:pr:chest'); // 80 × 8 supera 60 × 8
    expect(kinds).toContain('FUE:rank_up:chest');
    expect(kinds).toContain('VOL:volume_week:chest'); // 4 + 4 + 6 ≥ 10 en la semana
    expect(kinds).toContain('NUC:core:core');
    expect(kinds.filter((k) => k === 'DIS:plan_session')).toHaveLength(3);
    expect(ev.find((e) => e.kind === 'pr')!.reason).toBe('récord: press de banca con barra 80 kg × 8');
  });

  it('cada nivel da 3 puntos, priorizando lo más valioso y con variedad', () => {
    const input: AttributeInput = {
      xpEvents: [xpAt(0, 50), xpAt(2, 25), xpAt(3, 25), xpAt(4, 50)],
      workouts: [workout(0, [['ek-0042', 60, 8, 4]]), workout(2, [['ek-0042', 80, 8, 4], ['ek-0061', 20, 12, 6]])],
      gymDays: [1, 2, 4, 5],
      bodyweightKg: 84,
      now: new Date(base + 10 * D),
    };
    const pts = allocatePoints(input);
    expect(pts.map((p) => p.level)).toEqual([2, 2, 2, 3, 3, 3]);
    const lvl3 = pts.filter((p) => p.level === 3).map((p) => p.attr);
    // rank_up (3) y récord (2) son FUE; máximo 2 FUE → el tercero va a VOL
    expect(lvl3.sort()).toEqual(['FUE', 'FUE', 'VOL']);
    expect(pts.every((p) => p.reason.length > 0)).toBe(true);
  });

  it('sin hechos suficientes, refuerza el atributo más trabajado o Disciplina', () => {
    const pts = allocatePoints({ xpEvents: [xpAt(0, 100)], workouts: [], gymDays: [], bodyweightKg: null, now: new Date(base + D) });
    expect(pts.map((p) => [p.attr, p.kind])).toEqual([['DIS', 'fallback'], ['DIS', 'fallback'], ['DIS', 'fallback']]);
  });

  it('pérdida por inactividad (6 semanas), aviso a las 4 y recuperación', () => {
    const input: AttributeInput = {
      xpEvents: [xpAt(0, 100), xpAt(2, 100), xpAt(3, 100), xpAt(4, 100)],
      workouts: [workout(0, [['ek-0042', 60, 8, 4]]), workout(2, [['ek-0042', 80, 8, 4], ['ek-0061', 20, 12, 6]])],
      gymDays: [1, 2, 4, 5],
      bodyweightKg: 84,
      now: new Date(base + 10 * D),
    };
    const fresh = computeAttributes(input);
    expect(fresh.values.FUE).toBeGreaterThan(0);
    const risk = computeAttributes({ ...input, now: new Date(base + 32 * D) });
    expect(risk.atRisk).toEqual([{ muscle: 'chest', days: 30 }]);
    const lost = computeAttributes({ ...input, now: new Date(base + 50 * D) });
    expect(lost.values.FUE).toBe(0);
    expect(lost.values.VOL).toBe(0);
    expect(lost.values.DIS).toBe(fresh.values.DIS); // Disciplina no se pierde
    expect(lost.points.find((p) => p.attr === 'FUE')!.recover).toBe('entrena pecho para recuperarlo');
    const back = computeAttributes({ ...input, workouts: [...input.workouts, workout(50, [['ek-0042', 50, 8, 3]])], now: new Date(base + 50.5 * D) });
    expect(back.values.FUE).toBe(fresh.values.FUE);
    expect(recoveredPoints(lost, back).length).toBe(fresh.values.FUE + fresh.values.VOL);
  });
});

describe('servicio de atributos', () => {
  it('reparte retroactivamente con el historial real y da bonus al recuperar', async () => {
    const db = createTestDb();
    await migrate(db);
    const profileId = (await profilesRepo.create(db, { displayName: 'Test', heightCm: 175 })).id;
    await ensureDefaultPlan(db, profileId);
    await bodyMetricsRepo.create(db, profileId, { measuredAt: new Date().toISOString(), weightKg: 84, source: 'manual' });
    const push = (await templatesRepo.list(db, profileId)).find((t) => t.name === 'Pecho y tríceps')!;
    const w = await startFromTemplate(db, profileId, push.id);
    for (const s of (await workoutsRepo.listSets(db, w.id)).filter((x) => x.exerciseId === 'ek-0042')) {
      await workoutsRepo.updateSet(db, s.id, { repetitions: 8, weightKg: 80, completed: true });
    }
    await finishWorkout(db, w.id);
    const input = await loadAttributeInput(db, profileId);
    expect(input.workouts).toHaveLength(1);
    expect(input.gymDays).toEqual([1, 2, 4, 5]);
    const view = await computeAttributesView(db, profileId);
    // 100 XP → nivel 2 → 3 puntos; con un rank de pecho nuevo, FUE primero
    expect(view.now.points).toHaveLength(3);
    expect(view.now.points[0]).toMatchObject({ attr: 'FUE', kind: 'rank_up', muscle: 'chest' });
    expect(view.weekSets.chest).toBe(4);
    expect(view.pointsByMuscle.chest?.FUE).toBeGreaterThan(0);
    expect(await musclesAtRisk(db, profileId)).toEqual([]);
    expect(await musclesAtRisk(db, profileId, new Date(Date.now() + 30 * D))).toEqual([{ muscle: 'chest', days: 30 }]);
    db.close();
  });
});
