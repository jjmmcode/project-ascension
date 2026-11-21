import type { Db } from '@/database/types';
import { bodyMetricsRepo } from '@/database/repositories/bodyMetrics';
import { templatesRepo } from '@/database/repositories/templates';
import { effectiveLoadKg, type LoadMode } from '@/features/training/load';
import { findOption } from '@/features/training/exerciseOptions';
import { primaryMuscles } from '@/features/training/muscles';
import { OPTIONAL_DAYS } from '@/features/training/defaultPlan';
import { getLibraryExercise, type MuscleGroup } from '@/features/exercises/library';
import { isoWeekStart } from '@/lib/time';
import { awardXp } from './xp';
import {
  computeAttributes,
  recoveredPoints,
  type AttributeInput,
  type AttributePoint,
  type AttributeState,
  type HistoryWorkout,
} from '@/features/attributes/engine';

interface SetRow {
  workout_id: string;
  started_at: string;
  template_name: string | null;
  exercise_id: string;
  exercise_name: string;
  completed: number;
  repetitions: number | null;
  weight_kg: number | null;
  assistance_kg: number | null;
  bodyweight_kg: number | null;
  duration_seconds: number | null;
  load_mode: LoadMode | null;
}

/** Historial necesario para los atributos (sesiones terminadas, XP y plan). */
export async function loadAttributeInput(db: Db, profileId: string, now: Date = new Date()): Promise<AttributeInput> {
  const bodyweightKg = await bodyMetricsRepo.confirmedWeightNear(db, profileId, now.toISOString(), 120);
  // Las penitencias restan XP (cantidades negativas): el nivel puede bajar y sus puntos se pierden.
  const xp = await db.getAllAsync<{ amount: number; awarded_at: string }>(
    `SELECT amount, awarded_at FROM xp_events WHERE profile_id = ?
     UNION ALL SELECT -amount AS amount, applied_at AS awarded_at FROM xp_penalties WHERE profile_id = ?
     ORDER BY awarded_at ASC`,
    [profileId, profileId],
  );
  const rows = await db.getAllAsync<SetRow>(
    `SELECT w.id AS workout_id, w.started_at, t.name AS template_name, s.exercise_id, e.name AS exercise_name,
            s.completed, s.repetitions, s.weight_kg, s.assistance_kg, s.bodyweight_kg, s.duration_seconds, e.load_mode
     FROM workout_sets s
     JOIN workouts w ON w.id = s.workout_id
     JOIN exercises e ON e.id = s.exercise_id
     LEFT JOIN workout_templates t ON t.id = w.template_id
     WHERE w.profile_id = ? AND w.status = 'completed' AND w.deleted_at IS NULL
     ORDER BY w.started_at ASC, s.set_number ASC`,
    [profileId],
  );
  const byWorkout = new Map<string, HistoryWorkout>();
  for (const r of rows) {
    let w = byWorkout.get(r.workout_id);
    if (!w) {
      w = { id: r.workout_id, startedAt: r.started_at, templateName: r.template_name, sets: [] };
      byWorkout.set(r.workout_id, w);
    }
    const libraryId = findOption(r.exercise_id)?.libraryId ?? r.exercise_id;
    w.sets.push({
      libraryId,
      exerciseName: getLibraryExercise(libraryId)?.name ?? r.exercise_name,
      primary: primaryMuscles(r.exercise_id),
      performedAt: r.started_at,
      completed: r.completed === 1,
      repetitions: r.repetitions,
      effectiveKg: effectiveLoadKg(r.load_mode ?? 'external', {
        weightKg: r.weight_kg,
        assistanceKg: r.assistance_kg,
        bodyweightKg: r.bodyweight_kg ?? bodyweightKg,
      }),
      durationSeconds: r.duration_seconds,
    });
  }
  const schedule = await templatesRepo.schedule(db, profileId);
  const templates = await templatesRepo.list(db, profileId);
  const gymDays = schedule
    .filter((d) => d.templateId && !OPTIONAL_DAYS.has(d.weekday) && templates.find((t) => t.id === d.templateId)?.kind !== 'cardio')
    .map((d) => d.weekday);
  return {
    xpEvents: xp.map((x) => ({ amount: x.amount, at: x.awarded_at })),
    workouts: [...byWorkout.values()],
    gymDays,
    bodyweightKg,
    now,
    cardio: (
      await db.getAllAsync<{ started_at: string; minutes: number; speed_kmh: number; incline_pct: number }>(
        `SELECT started_at, minutes, speed_kmh, incline_pct FROM cardio_sessions WHERE profile_id = ? AND deleted_at IS NULL ORDER BY started_at ASC`,
        [profileId],
      )
    ).map((c) => ({ at: c.started_at, minutes: c.minutes, speedKmh: c.speed_kmh, inclinePct: c.incline_pct })),
  };
}

export interface AttributesView {
  now: AttributeState;
  /** Hace 30 días (para la línea punteada del hexágono). */
  monthAgo: AttributeState;
  /** Series de la semana actual por músculo (vista «Volumen» del mapa). */
  weekSets: Partial<Record<MuscleGroup, number>>;
  /** Puntos activos de FUE y VOL por músculo (vista «Puntos» del mapa). */
  pointsByMuscle: Partial<Record<MuscleGroup, { FUE: number; VOL: number }>>;
}

export async function computeAttributesView(db: Db, profileId: string, now: Date = new Date()): Promise<AttributesView> {
  const input = await loadAttributeInput(db, profileId, now);
  const state = computeAttributes(input);
  const monthAgo = computeAttributes({ ...input, now: new Date(now.getTime() - 30 * 86_400_000) });
  const week = isoWeekStart(now);
  const weekSets: AttributesView['weekSets'] = {};
  for (const w of input.workouts) {
    if (isoWeekStart(new Date(w.startedAt)) !== week) continue;
    for (const s of w.sets) if (s.completed) for (const m of s.primary) weekSets[m] = (weekSets[m] ?? 0) + 1;
  }
  const pointsByMuscle: AttributesView['pointsByMuscle'] = {};
  for (const p of state.points) {
    if (!p.active || !p.muscle || (p.attr !== 'FUE' && p.attr !== 'VOL')) continue;
    const cur = pointsByMuscle[p.muscle] ?? { FUE: 0, VOL: 0 };
    cur[p.attr] += 1;
    pointsByMuscle[p.muscle] = cur;
  }
  return { now: state, monthAgo, weekSets, pointsByMuscle };
}

export const RECOVERY_XP = 25;

/**
 * Memoria muscular: tras terminar una sesión, los puntos que vuelven de «perdidos» a activos
 * dan un bonus de XP (una vez por punto y día).
 */
export async function awardRecoveries(db: Db, profileId: string, before: AttributeState, after: AttributeState): Promise<AttributePoint[]> {
  const recovered = recoveredPoints(before, after);
  for (const p of recovered) {
    await awardXp(db, {
      profileId,
      source: 'recovery',
      sourceId: p.key,
      idempotencyKey: `recovery:${profileId}:${p.key}:${new Date().toISOString().slice(0, 10)}`,
    });
  }
  return recovered;
}

/** Músculos con 4–6 semanas sin entrenar (consulta ligera para Status). */
export async function musclesAtRisk(db: Db, profileId: string, now: Date = new Date()): Promise<Array<{ muscle: MuscleGroup; days: number }>> {
  const rows = await db.getAllAsync<{ exercise_id: string; last: string }>(
    `SELECT s.exercise_id, MAX(w.started_at) AS last FROM workout_sets s JOIN workouts w ON w.id = s.workout_id
     WHERE w.profile_id = ? AND w.status = 'completed' AND w.deleted_at IS NULL AND s.completed = 1
     GROUP BY s.exercise_id`,
    [profileId],
  );
  const last = new Map<MuscleGroup, number>();
  for (const r of rows) for (const m of primaryMuscles(r.exercise_id)) last.set(m, Math.max(last.get(m) ?? 0, Date.parse(r.last)));
  const out: Array<{ muscle: MuscleGroup; days: number }> = [];
  for (const [muscle, t] of last) {
    const days = Math.floor((now.getTime() - t) / 86_400_000);
    if (days >= 28 && days <= 42) out.push({ muscle, days });
  }
  return out.sort((a, b) => b.days - a.days);
}
