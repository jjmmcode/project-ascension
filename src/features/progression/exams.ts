/**
 * Examen de rango (lógica pura). Para subir de rango general hace falta el nivel mínimo y
 * además un mínimo de músculos con un rank de fuerza de su misma letra o superior
 * (tabla aprobada el 23-11-2026). Del S en adelante se piden más músculos en S (élite: más
 * fuerte que el 95 % de quienes entrenan), hasta los 11 en S para SSS+.
 * Los exámenes se aprueban en orden; un rango solo se pierde por inactividad (services/penance).
 */
import type { MuscleGroup } from '@/features/exercises/library';
import { GENERAL_RANKS, minLevelFor, type MuscleRankLetter, type Rank } from './leveling';

const MUSCLE_ORDER: MuscleRankLetter[] = ['E', 'D', 'C', 'B', 'A', 'S'];
const atLeast = (r: MuscleRankLetter | undefined, min: MuscleRankLetter) => r != null && MUSCLE_ORDER.indexOf(r) >= MUSCLE_ORDER.indexOf(min);

export interface ExamRequirement {
  count: number;
  min: MuscleRankLetter;
}

export const RANK_EXAMS: Partial<Record<Rank, ExamRequirement[]>> = {
  D: [{ count: 6, min: 'D' }],
  C: [{ count: 6, min: 'C' }],
  B: [{ count: 6, min: 'B' }],
  A: [{ count: 6, min: 'A' }],
  S: [{ count: 6, min: 'S' }],
  SS: [{ count: 8, min: 'S' }],
  SSS: [{ count: 10, min: 'S' }],
  'SSS+': [{ count: 11, min: 'S' }],
};

export interface RequirementStatus extends ExamRequirement {
  have: number;
  ok: boolean;
  /** Músculos que todavía no llegan, del más cercano al más lejano. */
  closest: MuscleGroup[];
}

export interface ExamStatus {
  rank: Rank;
  minLevel: number;
  levelOk: boolean;
  requirements: RequirementStatus[];
  ready: boolean;
}

export function nextRank(rank: Rank): Rank | null {
  const i = GENERAL_RANKS.indexOf(rank);
  return i >= 0 && i < GENERAL_RANKS.length - 1 ? GENERAL_RANKS[i + 1]! : null;
}

export function examStatus(
  rank: Rank,
  level: number,
  muscles: ReadonlyArray<{ muscle: MuscleGroup; rank: MuscleRankLetter; score: number }>,
  allMuscles: readonly MuscleGroup[],
): ExamStatus {
  const by = new Map(muscles.map((m) => [m.muscle, m]));
  const minLevel = minLevelFor(rank);
  const requirements = (RANK_EXAMS[rank] ?? []).map((req) => {
    const have = allMuscles.filter((m) => atLeast(by.get(m)?.rank, req.min)).length;
    const closest = allMuscles
      .filter((m) => !atLeast(by.get(m)?.rank, req.min))
      .sort((a, b) => (by.get(b)?.score ?? 0) - (by.get(a)?.score ?? 0));
    return { ...req, have, ok: have >= req.count, closest };
  });
  const levelOk = level >= minLevel;
  return { rank, minLevel, levelOk, requirements, ready: levelOk && requirements.every((r) => r.ok) };
}

/** Aprueba en orden todos los exámenes que se cumplan ahora. */
export function evaluateExams(
  passed: Rank,
  level: number,
  muscles: ReadonlyArray<{ muscle: MuscleGroup; rank: MuscleRankLetter; score: number }>,
  allMuscles: readonly MuscleGroup[],
): { passed: Rank; newlyPassed: Rank[]; next: ExamStatus | null } {
  let current = passed;
  const newlyPassed: Rank[] = [];
  for (let r = nextRank(current); r; r = nextRank(current)) {
    const st = examStatus(r, level, muscles, allMuscles);
    if (!st.ready) break;
    current = r;
    newlyPassed.push(r);
  }
  const n = nextRank(current);
  return { passed: current, newlyPassed, next: n ? examStatus(n, level, muscles, allMuscles) : null };
}
