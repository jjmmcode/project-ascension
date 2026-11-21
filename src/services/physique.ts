import { cardioMinutes7d, WEEKLY_CARDIO_MINUTES } from './cardio';
import type { Db } from '@/database/types';
import { bodyMetricsRepo } from '@/database/repositories/bodyMetrics';
import { templatesRepo } from '@/database/repositories/templates';
import { effectiveLoadKg, type LoadMode } from '@/features/training/load';
import { findOption } from '@/features/training/exerciseOptions';
import { primaryMuscles } from '@/features/training/muscles';
import { OPTIONAL_DAYS } from '@/features/training/defaultPlan';
import { localDateKey } from '@/lib/time';
import type { MuscleGroup } from '@/features/exercises/library';
import { computeMuscleRanks, epley1RM, MAX_REPS, MIN_REPS, type MuscleRank, type PhysiqueSet } from '@/features/physique/physique';

/** Músculos que se muestran en la ficha (el cuello no se entrena en el plan). */
export const PHYSIQUE_MUSCLES: MuscleGroup[] = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'core', 'glutes', 'quads', 'hamstrings', 'calves',
];

export interface PhysiqueStats {
  /** 0–100 por eje; null = aún no disponible. */
  fuerza: number;
  progresion: number;
  constancia: number | null;
  volumen: number;
  acondicionamiento: number | null;
}

export interface Physique {
  bodyweightKg: number | null;
  ranks: MuscleRank[];
  stats: PhysiqueStats;
  /** Récords (1RM estimado) de las últimas 4 semanas. */
  recentPrs: number;
}

interface Row {
  exercise_id: string;
  started_at: string;
  completed: number;
  repetitions: number | null;
  weight_kg: number | null;
  assistance_kg: number | null;
  bodyweight_kg: number | null;
  duration_seconds: number | null;
  load_mode: LoadMode | null;
}

async function loadSets(db: Db, profileId: string, sinceIso: string, bodyweightKg: number | null): Promise<PhysiqueSet[]> {
  const rows = await db.getAllAsync<Row>(
    `SELECT s.exercise_id, w.started_at, s.completed, s.repetitions, s.weight_kg, s.assistance_kg, s.bodyweight_kg,
            s.duration_seconds, e.load_mode
     FROM workout_sets s JOIN workouts w ON w.id = s.workout_id JOIN exercises e ON e.id = s.exercise_id
     WHERE w.profile_id = ? AND w.status = 'completed' AND w.deleted_at IS NULL AND s.completed = 1 AND w.started_at >= ?`,
    [profileId, sinceIso],
  );
  return rows.map((r) => {
    const mode = r.load_mode ?? 'external';
    return {
      libraryId: findOption(r.exercise_id)?.libraryId ?? r.exercise_id,
      primary: primaryMuscles(r.exercise_id),
      performedAt: r.started_at,
      completed: r.completed === 1,
      repetitions: r.repetitions,
      effectiveKg: effectiveLoadKg(mode, {
        weightKg: r.weight_kg,
        assistanceKg: r.assistance_kg,
        bodyweightKg: r.bodyweight_kg ?? bodyweightKg,
      }),
      durationSeconds: r.duration_seconds,
    };
  });
}

/** Récords: ejercicios cuyo mejor 1RM estimado de las últimas 4 semanas supera todo lo anterior. */
function countPrs(sets: PhysiqueSet[], now: Date): number {
  const cut = now.getTime() - 28 * 86_400_000;
  const before = new Map<string, number>();
  const recent = new Map<string, number>();
  for (const s of sets) {
    const r = s.repetitions ?? 0;
    if (!s.effectiveKg || r < MIN_REPS || r > MAX_REPS) continue;
    const v = epley1RM(s.effectiveKg, r);
    const map = Date.parse(s.performedAt) >= cut ? recent : before;
    map.set(s.libraryId, Math.max(map.get(s.libraryId) ?? 0, v));
  }
  let n = 0;
  for (const [id, v] of recent) {
    const prev = before.get(id);
    if (prev != null && v > prev + 0.01) n++;
  }
  return n;
}

async function consistency(db: Db, profileId: string, now: Date): Promise<number | null> {
  const schedule = await templatesRepo.schedule(db, profileId);
  const templates = await templatesRepo.list(db, profileId);
  const gymDays = new Set(
    schedule
      .filter((d) => d.templateId && !OPTIONAL_DAYS.has(d.weekday) && templates.find((t) => t.id === d.templateId)?.kind !== 'cardio')
      .map((d) => d.weekday),
  );
  if (gymDays.size === 0) return null;
  const since = new Date(now.getTime() - 28 * 86_400_000);
  const rows = await db.getAllAsync<{ started_at: string }>(
    `SELECT started_at FROM workouts WHERE profile_id = ? AND status = 'completed' AND deleted_at IS NULL AND started_at >= ?`,
    [profileId, since.toISOString()],
  );
  const trained = new Set(rows.map((r) => localDateKey(new Date(r.started_at))));
  const today = localDateKey(now);
  // Días de gimnasio del plan en las últimas 4 semanas. Solo cuenta desde la primera sesión, para no castigar días antes de usar la app.
  const first = await db.getFirstAsync<{ started_at: string | null }>(
    `SELECT MIN(started_at) AS started_at FROM workouts WHERE profile_id = ? AND status = 'completed' AND deleted_at IS NULL`,
    [profileId],
  );
  if (!first?.started_at) return null;
  const firstKey = localDateKey(new Date(first.started_at));
  let planned = 0;
  let done = 0;
  for (let i = 0; i < 28; i++) {
    const key = localDateKey(new Date(now.getTime() - i * 86_400_000));
    if (key < firstKey) break;
    const dow = new Date(`${key}T12:00:00Z`).getUTCDay() || 7;
    if (!gymDays.has(dow)) continue;
    if (key === today && !trained.has(key)) continue; // hoy aún puedes entrenar
    planned++;
    if (trained.has(key)) done++;
  }
  return planned === 0 ? null : Math.round((done / planned) * 100);
}

export async function computePhysique(db: Db, profileId: string, now: Date = new Date()): Promise<Physique> {
  const bodyweightKg = await bodyMetricsRepo.confirmedWeightNear(db, profileId, now.toISOString(), 120);
  const since = new Date(now.getTime() - 180 * 86_400_000).toISOString();
  const sets = await loadSets(db, profileId, since, bodyweightKg);
  const ranks = bodyweightKg ? computeMuscleRanks(sets, bodyweightKg, now) : [];

  const byMuscle = new Map(ranks.map((r) => [r.muscle, r.score]));
  const fuerza = Math.round((PHYSIQUE_MUSCLES.reduce((a, m) => a + (byMuscle.get(m) ?? 0), 0) / PHYSIQUE_MUSCLES.length / 6) * 100);

  const recentPrs = countPrs(sets, now);
  const weekAgo = now.getTime() - 7 * 86_400_000;
  const weekly = new Map<MuscleGroup, number>();
  for (const s of sets) {
    if (Date.parse(s.performedAt) < weekAgo) continue;
    for (const m of s.primary) weekly.set(m, (weekly.get(m) ?? 0) + 1);
  }
  const volumen = Math.round(
    (PHYSIQUE_MUSCLES.reduce((a, m) => a + Math.min(1, (weekly.get(m) ?? 0) / 10), 0) / PHYSIQUE_MUSCLES.length) * 100,
  );

  return {
    bodyweightKg,
    ranks,
    recentPrs,
    stats: {
      fuerza,
      progresion: Math.min(100, recentPrs * 12.5),
      constancia: await consistency(db, profileId, now),
      volumen,
      acondicionamiento: Math.min(100, Math.round((await cardioMinutes7d(db, profileId, now)) / WEEKLY_CARDIO_MINUTES * 100)),
    },
  };
}
