/**
 * Rank de fuerza por músculo (lógica pura).
 *
 * Por cada ejercicio con estándar: mejor serie de los últimos 90 días →
 *   carga: 1RM estimado (Epley, solo series de 3–15 reps) / peso corporal
 *   tiempo: segundos sostenidos
 * comparado con 5 umbrales → puntuación continua 0–6 (E 0–1, D 1–2, C 2–3, B 3–4, A 4–5, S ≥5).
 * El músculo toma la mejor puntuación de sus ejercicios principales (como Ascend, cada movimiento sube aparte).
 * Si un músculo no se entrena en 6 semanas, baja un rank.
 */
import type { MuscleGroup } from '@/features/exercises/library';
import type { MuscleRankLetter as Rank } from '@/features/progression/leveling';
import { standardFor, type Standard } from './standards';

export const RANKS: Rank[] = ['E', 'D', 'C', 'B', 'A', 'S'];
export const WINDOW_DAYS = 90;
export const DECAY_DAYS = 42;
export const MIN_REPS = 3;
export const MAX_REPS = 15;

export interface PhysiqueSet {
  /** Id de la biblioteca ("ek-0042"). */
  libraryId: string;
  primary: MuscleGroup[];
  performedAt: string;
  completed: boolean;
  repetitions: number | null;
  /** Carga efectiva en kg (peso libre, o peso corporal ± lastre/asistencia). */
  effectiveKg: number | null;
  durationSeconds: number | null;
}

export interface MuscleRank {
  muscle: MuscleGroup;
  score: number;
  rank: Rank;
  /** true si el mejor ejercicio usa un estándar aproximado. */
  approx: boolean;
  bestLibraryId: string;
  /** Qué falta para el siguiente rank con el mejor ejercicio. */
  next: { rank: Rank; kind: 'kg'; kg: number; reps: number } | { rank: Rank; kind: 'seconds'; seconds: number } | null;
  lastTrainedAt: string;
  decayed: boolean;
}

export const epley1RM = (kg: number, reps: number) => kg * (1 + reps / 30);

export function scoreFrom(value: number, t: readonly number[]): number {
  if (!(value > 0)) return 0;
  if (value < t[0]!) return value / t[0]!;
  for (let i = 0; i < 4; i++) {
    const lo = t[i]!;
    const hi = t[i + 1]!;
    if (value < hi) return i + 1 + (value - lo) / (hi - lo);
  }
  // Por encima de élite: se llena la barra de S hasta +25 %.
  return Math.min(6, 5 + (value - t[4]!) / (t[4]! * 0.25));
}

export const rankFromScore = (score: number): Rank => RANKS[Math.max(0, Math.min(5, Math.floor(score)))]!;

function setValue(std: Standard, s: PhysiqueSet, bodyweightKg: number): { value: number; reps: number } | null {
  if (std.type === 'time') return s.durationSeconds && s.durationSeconds > 0 ? { value: s.durationSeconds, reps: 0 } : null;
  const reps = s.repetitions ?? 0;
  if (reps < MIN_REPS || reps > MAX_REPS || !s.effectiveKg || s.effectiveKg <= 0) return null;
  return { value: epley1RM(s.effectiveKg, reps) / bodyweightKg, reps };
}

export function computeMuscleRanks(sets: PhysiqueSet[], bodyweightKg: number, now: Date = new Date()): MuscleRank[] {
  if (!(bodyweightKg > 0)) return [];
  const since = now.getTime() - WINDOW_DAYS * 86_400_000;
  // Mejor serie por ejercicio
  const best = new Map<string, { score: number; reps: number; primary: MuscleGroup[]; std: Standard; last: string }>();
  for (const s of sets) {
    if (!s.completed || Date.parse(s.performedAt) < since) continue;
    const std = standardFor(s.libraryId);
    if (!std) continue;
    const v = setValue(std, s, bodyweightKg);
    if (!v) continue;
    const thresholds = std.type === 'time' ? std.seconds : std.ratios;
    const score = scoreFrom(v.value, thresholds);
    const prev = best.get(s.libraryId);
    const last = prev && prev.last > s.performedAt ? prev.last : s.performedAt;
    if (!prev || score > prev.score) best.set(s.libraryId, { score, reps: v.reps, primary: s.primary, std, last });
    else prev.last = last;
  }
  // Mejor ejercicio por músculo
  const byMuscle = new Map<MuscleGroup, { libraryId: string; score: number; reps: number; std: Standard; last: string }>();
  for (const [libraryId, b] of best) {
    for (const m of b.primary) {
      const cur = byMuscle.get(m);
      const last = cur && cur.last > b.last ? cur.last : b.last;
      if (!cur || b.score > cur.score) byMuscle.set(m, { libraryId, score: b.score, reps: b.reps, std: b.std, last });
      else cur.last = last;
    }
  }
  const out: MuscleRank[] = [];
  for (const [muscle, b] of byMuscle) {
    const decayed = now.getTime() - Date.parse(b.last) > DECAY_DAYS * 86_400_000;
    const score = decayed ? Math.max(0, b.score - 1) : b.score;
    const rank = rankFromScore(score);
    const idx = RANKS.indexOf(rank);
    let next: MuscleRank['next'] = null;
    if (idx < 5) {
      const nextRank = RANKS[idx + 1]!;
      if (b.std.type === 'time') {
        next = { rank: nextRank, kind: 'seconds', seconds: Math.ceil(b.std.seconds[idx]!) };
      } else {
        const target1RM = b.std.ratios[idx]! * bodyweightKg;
        const reps = b.reps || 10;
        next = { rank: nextRank, kind: 'kg', kg: Math.ceil((target1RM / (1 + reps / 30)) * 2) / 2, reps };
      }
    }
    out.push({
      muscle,
      score,
      rank,
      approx: b.std.kind === 'approx',
      bestLibraryId: b.libraryId,
      next,
      lastTrainedAt: b.last,
      decayed,
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

/** Cambios de rank entre dos cálculos (para la animación al terminar la sesión). */
export function rankUps(before: MuscleRank[], after: MuscleRank[]): Array<{ muscle: MuscleGroup; from: Rank | null; to: Rank }> {
  const prev = new Map(before.map((m) => [m.muscle, m.rank]));
  return after
    .filter((m) => {
      const p = prev.get(m.muscle);
      return p == null ? m.rank !== 'E' : RANKS.indexOf(m.rank) > RANKS.indexOf(p);
    })
    .map((m) => ({ muscle: m.muscle, from: prev.get(m.muscle) ?? null, to: m.rank }));
}
