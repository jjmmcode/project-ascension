import { z } from 'zod';
import type { Db } from '@/database/types';
import { transaction } from '@/database/transaction';
import { settingsRepo } from '@/database/repositories/settings';
import { templatesRepo } from '@/database/repositories/templates';
import { GENERAL_RANKS, levelFromXp, type Rank } from '@/features/progression/leveling';
import { evaluateExams, type ExamStatus } from '@/features/progression/exams';
import { getLibraryExercise, MUSCLE_GROUP_LABEL, type MuscleGroup } from '@/features/exercises/library';
import { findOption } from '@/features/training/exerciseOptions';
import { primaryMuscles } from '@/features/training/muscles';
import type { MuscleRank } from '@/features/physique/physique';
import { isoWeekStart } from '@/lib/time';
import { computePhysique, PHYSIQUE_MUSCLES } from './physique';
import { awardXp, totalXp } from './xp';

const PASSED_KEY = 'rank.passed';
const rankSchema = z.enum(GENERAL_RANKS as [Rank, ...Rank[]]);

/** Rango general aprobado (persistente: no baja aunque luego bajen los músculos). */
export async function getPassedRank(db: Db, profileId: string): Promise<Rank> {
  return (await settingsRepo.get(db, profileId, PASSED_KEY, rankSchema)) ?? 'E';
}

export interface RankEvaluation {
  passed: Rank;
  newlyPassed: Rank[];
  next: ExamStatus | null;
  level: number;
  muscles: MuscleRank[];
}

export const EXAM_XP = 200;

/** Evalúa los exámenes pendientes, guarda el rango aprobado y da la XP de cada examen (una vez). */
export async function evaluateRank(db: Db, profileId: string, now: Date = new Date()): Promise<RankEvaluation> {
  const physique = await computePhysique(db, profileId, now);
  return transaction(db, async (db) => {
    let passed = await getPassedRank(db, profileId);
    const newlyPassed: Rank[] = [];
    let result = evaluateExams(passed, levelFromXp(await totalXp(db, profileId)).level, physique.ranks, PHYSIQUE_MUSCLES);
    // La XP del examen puede subir de nivel y habilitar el siguiente: se repite hasta estabilizar.
    for (let guard = 0; guard < GENERAL_RANKS.length && result.newlyPassed.length > 0; guard++) {
      for (const r of result.newlyPassed) {
        await awardXp(db, { profileId, source: 'exam', sourceId: r, idempotencyKey: `exam:${profileId}:${r}`, at: now });
        newlyPassed.push(r);
      }
      passed = result.passed;
      await settingsRepo.set(db, profileId, PASSED_KEY, rankSchema, passed);
      result = evaluateExams(passed, levelFromXp(await totalXp(db, profileId)).level, physique.ranks, PHYSIQUE_MUSCLES);
    }
    return {
      passed,
      newlyPassed,
      next: result.next,
      level: levelFromXp(await totalXp(db, profileId)).level,
      muscles: physique.ranks,
    };
  });
}

// ─── Misión semanal: el músculo más débil ───────────────────────────────────

export const WEAK_MISSION_SETS = 10;
export const WEAK_MISSION_XP = 50;

export interface WeakMission {
  week: string;
  muscle: MuscleGroup;
  label: string;
  rank: MuscleRank['rank'] | null;
  sets: number;
  goal: number;
  done: boolean;
  rewarded: boolean;
  /** Ejercicios de tus rutinas que trabajan ese músculo. */
  suggestions: string[];
  /** Siguiente rank de fuerza del músculo, si hay datos. */
  next: MuscleRank['next'];
}

const weakKey = (week: string) => `quest.weak.${week}`;
const muscleSchema = z.string();

/** Elige (una vez por semana) el músculo con menor rank de fuerza; sin datos cuenta como el más débil. */
async function weekMuscle(db: Db, profileId: string, week: string, ranks: MuscleRank[]): Promise<MuscleGroup> {
  const saved = await settingsRepo.get(db, profileId, weakKey(week), muscleSchema);
  if (saved && (PHYSIQUE_MUSCLES as string[]).includes(saved)) return saved as MuscleGroup;
  const score = new Map(ranks.map((r) => [r.muscle, r.score]));
  const weakest = [...PHYSIQUE_MUSCLES].sort((a, b) => (score.get(a) ?? -1) - (score.get(b) ?? -1))[0]!;
  await settingsRepo.set(db, profileId, weakKey(week), muscleSchema, weakest);
  return weakest;
}

export async function weakMission(db: Db, profileId: string, now: Date = new Date(), ranks?: MuscleRank[]): Promise<WeakMission> {
  const week = isoWeekStart(now);
  const muscleRanks = ranks ?? (await computePhysique(db, profileId, now)).ranks;
  const muscle = await weekMuscle(db, profileId, week, muscleRanks);
  const rows = await db.getAllAsync<{ exercise_id: string; started_at: string }>(
    `SELECT s.exercise_id, w.started_at FROM workout_sets s JOIN workouts w ON w.id = s.workout_id
     WHERE w.profile_id = ? AND w.status = 'completed' AND w.deleted_at IS NULL AND s.completed = 1 AND w.started_at >= ?`,
    [profileId, new Date(now.getTime() - 8 * 86_400_000).toISOString()],
  );
  const sets = rows.filter((r) => isoWeekStart(new Date(r.started_at)) === week && primaryMuscles(r.exercise_id).includes(muscle)).length;
  const rewarded = !!(await db.getFirstAsync<{ id: string }>('SELECT id FROM xp_events WHERE idempotency_key = ?', [
    `quest:weak:${profileId}:${week}`,
  ]));
  const suggestions: string[] = [];
  for (const t of await templatesRepo.list(db, profileId)) {
    for (const e of await templatesRepo.exercises(db, t.id)) {
      if (primaryMuscles(e.exerciseId).includes(muscle)) {
        const name = getLibraryExercise(findOption(e.exerciseId)?.libraryId ?? e.exerciseId)?.name ?? e.exerciseName;
        if (!suggestions.includes(name)) suggestions.push(name);
      }
    }
  }
  const r = muscleRanks.find((m) => m.muscle === muscle);
  return {
    week,
    muscle,
    label: MUSCLE_GROUP_LABEL[muscle],
    rank: r?.rank ?? null,
    sets,
    goal: WEAK_MISSION_SETS,
    done: sets >= WEAK_MISSION_SETS,
    rewarded,
    suggestions: suggestions.slice(0, 4),
    next: r?.next ?? null,
  };
}

/** Da la XP de la misión semanal si está cumplida (idempotente). Devuelve true si la entregó ahora. */
export async function claimWeakMission(db: Db, profileId: string, mission: WeakMission, now: Date = new Date()): Promise<boolean> {
  if (!mission.done || mission.rewarded) return false;
  const r = await awardXp(db, {
    profileId,
    source: 'quest',
    sourceId: `weak:${mission.week}:${mission.muscle}`,
    idempotencyKey: `quest:weak:${profileId}:${mission.week}`,
    at: now,
  });
  return r.awarded > 0;
}
