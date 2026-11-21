/**
 * Atributos estilo Xenoverse, ganados con entrenamiento real (lógica pura, determinista).
 *
 * - Cada nivel alcanzado (desde el 2) da 3 puntos.
 * - Se reparten solos según lo que hiciste entre ese nivel y el anterior (como el modo
 *   automático de Habitica): récords y subidas de rank → FUE; semanas con ≥10 series en un
 *   músculo → VOL; sesiones del plan y semanas completas → DIS; sesiones de core → NÚC.
 *   caminadora → RES (sesiones de ≥20 min y semanas de 150 min). VIT (nutrición) llega en la Fase 3.
 * - Cada punto guarda su motivo («récord: curl con barra 30 kg × 10»).
 * - Pérdida por inactividad: los puntos físicos (FUE, VOL, NÚC, RES) quedan «perdidos» si su
 *   fuente lleva más de 6 semanas sin entrenarse (RES: 6 semanas sin cardio); DIS nunca se pierde. Al volver a entrenar esa
 *   fuente, el punto se recupera (memoria muscular).
 * Al recalcularse desde el historial, el reparto es retroactivo y siempre coherente.
 */
import { levelFromXp, totalXpForLevel } from '@/features/progression/leveling';
import { computeMuscleRanks, epley1RM, MAX_REPS, MIN_REPS, RANKS, type PhysiqueSet } from '@/features/physique/physique';
import type { MuscleGroup } from '@/features/exercises/library';
import type { MuscleRankLetter as Rank } from '@/features/progression/leveling';
import { isoWeekStart, localDateKey } from '@/lib/time';

export type AttributeKey = 'FUE' | 'VOL' | 'DIS' | 'NUC' | 'RES' | 'VIT';
export const ATTRIBUTES: AttributeKey[] = ['FUE', 'VOL', 'DIS', 'NUC', 'RES', 'VIT'];
export const ATTRIBUTE_MAX = 100;
export const POINTS_PER_LEVEL = 3;
export const LOSS_DAYS = 42;
export const WARNING_DAYS = 28;
const DAY = 86_400_000;

export const ATTRIBUTE_INFO: Record<AttributeKey, { short: string; name: string; source: string; available: boolean }> = {
  FUE: { short: 'FUE', name: 'Fuerza', source: 'récords y subidas de rank', available: true },
  VOL: { short: 'VOL', name: 'Volumen', source: 'semanas con ≥10 series por músculo', available: true },
  DIS: { short: 'DIS', name: 'Disciplina', source: 'sesiones del plan y semanas completas', available: true },
  NUC: { short: 'NÚC', name: 'Núcleo', source: 'sesiones de core', available: true },
  RES: { short: 'RES', name: 'Resistencia', source: 'caminadora: sesiones de ≥20 min y semanas de 150 min', available: true },
  VIT: { short: 'VIT', name: 'Vitalidad', source: 'nutrición e hidratación (Fase 3)', available: false },
};

export interface HistoryWorkout {
  id: string;
  startedAt: string;
  /** Nombre de la rutina del plan (null = sesión libre). */
  templateName: string | null;
  sets: Array<PhysiqueSet & { exerciseName: string }>;
}

export interface AttributeInput {
  xpEvents: Array<{ amount: number; at: string }>;
  workouts: HistoryWorkout[];
  /** Días ISO (1–7) de gimnasio del plan, sin el miércoles opcional ni cardio. */
  gymDays: number[];
  bodyweightKg: number | null;
  now: Date;
  /** Sesiones de caminadora (Fase 2). */
  cardio?: Array<{ at: string; minutes: number; speedKmh: number; inclinePct: number }>;
}

type EventKind = 'rank_up' | 'pr' | 'volume_week' | 'week_complete' | 'core' | 'plan_session' | 'cardio' | 'cardio_week';

export const CARDIO_SESSION_MIN = 20;
export const CARDIO_WEEK_MIN = 150;

interface ActivityEvent {
  attr: AttributeKey;
  kind: EventKind;
  weight: number;
  at: string;
  muscle: MuscleGroup | null;
  reason: string;
}

export interface AttributePoint {
  key: string;
  level: number;
  attr: AttributeKey;
  kind: EventKind | 'fallback';
  muscle: MuscleGroup | null;
  reason: string;
  at: string;
  active: boolean;
  /** Si está perdido, qué hacer para recuperarlo. */
  recover: string | null;
}

export interface AttributeState {
  level: number;
  points: AttributePoint[];
  values: Record<AttributeKey, number>;
  /** Músculos con 4–6 semanas sin entrenar (en riesgo de perder rank y puntos). */
  atRisk: Array<{ muscle: MuscleGroup; days: number }>;
}

const MUSCLE_ES: Record<MuscleGroup, string> = {
  chest: 'pecho', back: 'espalda', shoulders: 'hombros', biceps: 'bíceps', triceps: 'tríceps', forearms: 'antebrazos',
  core: 'core', glutes: 'glúteos', quads: 'cuádriceps', hamstrings: 'isquios', calves: 'gemelos', neck: 'cuello',
};
const fmtKg = (n: number) => (Math.round(n * 10) / 10).toString().replace('.', ',');

/**
 * Primera vez que se alcanzó cada nivel (índice = nivel). Las penitencias (cantidades negativas)
 * pueden bajar el nivel; al volver a subirlo se conserva la fecha original (mismos puntos).
 */
export function levelTimeline(xpEvents: AttributeInput['xpEvents']): Map<number, string> {
  const out = new Map<number, string>();
  let total = 0;
  let level = 1;
  for (const e of [...xpEvents].sort((a, b) => a.at.localeCompare(b.at))) {
    total = Math.max(0, total + e.amount);
    while (level > 1 && total < totalXpForLevel(level)) level--;
    while (level < 100 && total >= totalXpForLevel(level + 1)) {
      level++;
      if (!out.has(level)) out.set(level, e.at);
    }
  }
  return out;
}

/** Hechos de entrenamiento que pueden dar puntos, en orden cronológico. */
export function activityEvents(input: AttributeInput): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  const best1RM = new Map<string, number>();
  const bestRank = new Map<MuscleGroup, Rank>();
  const weekMuscle = new Map<string, number>();
  const weekGymDays = new Map<string, Set<string>>();
  const history: PhysiqueSet[] = [];
  const gym = new Set(input.gymDays);
  const workouts = [...input.workouts].sort((a, b) => a.startedAt.localeCompare(b.startedAt));

  for (const w of workouts) {
    const done = w.sets.filter((s) => s.completed);
    const at = w.startedAt;
    const day = new Date(at);
    const week = isoWeekStart(day);

    // Récords de 1RM estimado (la primera vez que haces un ejercicio no es récord)
    const sessionBest = new Map<string, { v: number; kg: number; reps: number; name: string; muscle: MuscleGroup | null }>();
    for (const s of done) {
      const r = s.repetitions ?? 0;
      if (!s.effectiveKg || r < MIN_REPS || r > MAX_REPS) continue;
      const v = epley1RM(s.effectiveKg, r);
      const cur = sessionBest.get(s.libraryId);
      if (!cur || v > cur.v) sessionBest.set(s.libraryId, { v, kg: s.effectiveKg, reps: r, name: s.exerciseName, muscle: s.primary[0] ?? null });
    }
    for (const [id, b] of sessionBest) {
      const prev = best1RM.get(id);
      if (prev != null && b.v > prev + 0.01) {
        events.push({
          attr: 'FUE', kind: 'pr', weight: 2, at, muscle: b.muscle,
          reason: `récord: ${b.name.toLowerCase()} ${fmtKg(b.kg)} kg × ${b.reps}`,
        });
      }
      best1RM.set(id, Math.max(prev ?? 0, b.v));
    }

    // Subidas de rank por encima del mejor rank alcanzado (no se puede farmear bajando y subiendo)
    history.push(...done);
    if (input.bodyweightKg) {
      for (const r of computeMuscleRanks(history, input.bodyweightKg, day)) {
        const prev = bestRank.get(r.muscle);
        if (RANKS.indexOf(r.rank) > RANKS.indexOf(prev ?? 'E') || (prev == null && r.rank !== 'E')) {
          events.push({
            attr: 'FUE', kind: 'rank_up', weight: 3, at, muscle: r.muscle,
            reason: `${MUSCLE_ES[r.muscle]} ${prev ?? 'E'} → ${r.rank}`,
          });
        }
        if (prev == null || RANKS.indexOf(r.rank) > RANKS.indexOf(prev)) bestRank.set(r.muscle, r.rank);
      }
    }

    // Volumen: el músculo llega a 10 series en la semana
    for (const s of done) {
      for (const m of s.primary) {
        const k = `${week}|${m}`;
        const n = (weekMuscle.get(k) ?? 0) + 1;
        weekMuscle.set(k, n);
        if (n === 10) events.push({ attr: 'VOL', kind: 'volume_week', weight: 2, at, muscle: m, reason: `${MUSCLE_ES[m]}: 10 series en la semana` });
      }
    }

    // Núcleo
    if (done.filter((s) => s.primary.includes('core')).length >= 3) {
      events.push({ attr: 'NUC', kind: 'core', weight: 2, at, muscle: 'core', reason: 'sesión de core' });
    }

    // Disciplina: sesión del plan y semana completa
    if (w.templateName && done.length >= 3) {
      events.push({ attr: 'DIS', kind: 'plan_session', weight: 1, at, muscle: null, reason: `sesión: ${w.templateName.toLowerCase()}` });
      const dow = new Date(`${localDateKey(day)}T12:00:00Z`).getUTCDay() || 7;
      if (gym.has(dow)) {
        const set = weekGymDays.get(week) ?? new Set<string>();
        const before = set.size;
        set.add(localDateKey(day));
        weekGymDays.set(week, set);
        if (gym.size > 0 && before < gym.size && set.size >= gym.size) {
          events.push({ attr: 'DIS', kind: 'week_complete', weight: 3, at, muscle: null, reason: `semana del plan completa (${set.size}/${gym.size})` });
        }
      }
    }
  }

  // Resistencia: caminadora
  const weekCardio = new Map<string, number>();
  for (const c of [...(input.cardio ?? [])].sort((a, b) => a.at.localeCompare(b.at))) {
    const n = (x: number) => String(Math.round(x * 10) / 10).replace('.', ',');
    if (c.minutes >= CARDIO_SESSION_MIN) {
      events.push({
        attr: 'RES', kind: 'cardio', weight: 2, at: c.at, muscle: null,
        reason: `caminadora ${n(c.minutes)} min a ${n(c.speedKmh)} km/h${c.inclinePct ? `, ${n(c.inclinePct)} %` : ''}`,
      });
    }
    const wk = isoWeekStart(new Date(c.at));
    const before = weekCardio.get(wk) ?? 0;
    weekCardio.set(wk, before + c.minutes);
    if (before < CARDIO_WEEK_MIN && before + c.minutes >= CARDIO_WEEK_MIN) {
      events.push({ attr: 'RES', kind: 'cardio_week', weight: 3, at: c.at, muscle: null, reason: `${CARDIO_WEEK_MIN} min de cardio en la semana` });
    }
  }
  return events;
}

/** Reparte los 3 puntos de cada nivel con los hechos de su tramo. */
export function allocatePoints(input: AttributeInput): Omit<AttributePoint, 'active' | 'recover'>[] {
  const now = input.now.toISOString();
  const xp = input.xpEvents.filter((e) => e.at <= now);
  const timeline = levelTimeline(xp);
  const events = activityEvents(input).filter((e) => e.at <= now);
  const points: Omit<AttributePoint, 'active' | 'recover'>[] = [];
  let prevAt = '';
  let carry: ActivityEvent[] = [];
  const levels = [...timeline.keys()].sort((a, b) => a - b);
  for (const level of levels) {
    const at = timeline.get(level)!;
    const window = [...carry, ...events.filter((e) => e.at > prevAt && e.at <= at)];
    const sorted = [...window].sort((a, b) => b.weight - a.weight || a.at.localeCompare(b.at));
    const picked: ActivityEvent[] = [];
    const perAttr = new Map<AttributeKey, number>();
    // Variedad: máximo 2 puntos del mismo atributo por nivel si hay alternativas
    for (const e of sorted) {
      if (picked.length >= POINTS_PER_LEVEL) break;
      if ((perAttr.get(e.attr) ?? 0) >= 2) continue;
      picked.push(e);
      perAttr.set(e.attr, (perAttr.get(e.attr) ?? 0) + 1);
    }
    for (const e of sorted) {
      if (picked.length >= POINTS_PER_LEVEL) break;
      if (!picked.includes(e)) picked.push(e);
    }
    // Las subidas de rank no usadas pasan al siguiente nivel (son raras y valiosas)
    carry = window.filter((e) => e.kind === 'rank_up' && !picked.includes(e));
    let slot = 0;
    for (const e of picked) {
      points.push({ key: `${level}-${++slot}`, level, attr: e.attr, kind: e.kind, muscle: e.muscle, reason: e.reason, at: e.at });
    }
    // Sin hechos suficientes: refuerzo del atributo más trabajado en el tramo (o Disciplina)
    while (slot < POINTS_PER_LEVEL) {
      const counts = new Map<AttributeKey, ActivityEvent>();
      for (const e of window) counts.set(e.attr, e);
      const top = [...ATTRIBUTES].map((a) => ({ a, n: window.filter((e) => e.attr === a).length })).sort((x, y) => y.n - x.n)[0]!;
      const last = top.n > 0 ? counts.get(top.a)! : null;
      points.push({
        key: `${level}-${++slot}`,
        level,
        attr: last ? last.attr : 'DIS',
        kind: 'fallback',
        muscle: last?.muscle ?? null,
        reason: last ? `refuerzo: ${last.reason}` : 'constancia: nivel alcanzado',
        at,
      });
    }
    prevAt = at;
  }
  return points;
}

/** Último entrenamiento de cada músculo (y del core) hasta `now`. */
function lastTrained(workouts: HistoryWorkout[], now: Date): Map<MuscleGroup, number> {
  const out = new Map<MuscleGroup, number>();
  for (const w of workouts) {
    const t = Date.parse(w.startedAt);
    if (t > now.getTime()) continue;
    for (const s of w.sets) {
      if (!s.completed) continue;
      for (const m of s.primary) out.set(m, Math.max(out.get(m) ?? 0, t));
    }
  }
  return out;
}

export function computeAttributes(input: AttributeInput): AttributeState {
  let running = 0;
  for (const e of [...input.xpEvents].filter((x) => x.at <= input.now.toISOString()).sort((a, b) => a.at.localeCompare(b.at))) {
    running = Math.max(0, running + e.amount);
  }
  const level = levelFromXp(running).level;
  const last = lastTrained(input.workouts, input.now);
  const nowT = input.now.getTime();
  const lastCardio = Math.max(0, ...(input.cardio ?? []).map((c) => Date.parse(c.at)).filter((t) => t <= nowT));
  const points: AttributePoint[] = allocatePoints(input).map((p) => {
    // Nivel perdido por penitencia: sus 3 puntos se pierden hasta recuperarlo
    if (p.level > level) return { ...p, active: false, recover: `recupera el nivel ${p.level}` };
    if (p.attr === 'RES') {
      const off = !lastCardio || nowT - lastCardio > LOSS_DAYS * DAY;
      return { ...p, active: !off, recover: off ? 'vuelve a la caminadora para recuperarlo' : null };
    }
    if (p.attr === 'DIS' || !p.muscle) return { ...p, active: true, recover: null };
    const t = last.get(p.muscle);
    const inactive = t == null || nowT - t > LOSS_DAYS * DAY;
    return {
      ...p,
      active: !inactive,
      recover: inactive ? `entrena ${MUSCLE_ES[p.muscle]} para recuperarlo` : null,
    };
  });
  const values = Object.fromEntries(ATTRIBUTES.map((a) => [a, 0])) as Record<AttributeKey, number>;
  for (const p of points) if (p.active) values[p.attr] = Math.min(ATTRIBUTE_MAX, values[p.attr] + 1);
  const atRisk: AttributeState['atRisk'] = [];
  for (const [muscle, t] of last) {
    const days = Math.floor((nowT - t) / DAY);
    if (days >= WARNING_DAYS && days <= LOSS_DAYS) atRisk.push({ muscle, days });
  }
  return { level, points, values, atRisk: atRisk.sort((a, b) => b.days - a.days) };
}

/** Puntos que estaban perdidos y ahora están activos (memoria muscular). */
export function recoveredPoints(before: AttributeState, after: AttributeState): AttributePoint[] {
  const prev = new Map(before.points.map((p) => [p.key, p]));
  return after.points.filter((p) => p.active && prev.get(p.key)?.active === false);
}
