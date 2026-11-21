import { create } from 'zustand';
import { bodyMetricsRepo, goalsRepo, profilesRepo, type BodyMetric, type Db, type Goal, type Profile } from '@/database';
import { workoutsRepo, type Workout } from '@/database/repositories/workouts';
import type { GoalType } from '@/features/progression/goalSchema';
import { totalXp } from '@/services/xp';
import { backfillWorkoutEnergy, workoutsThisWeek } from '@/services/workoutSession';
import { applyPlanUpdates, ensureDefaultPlan, todayPlan, type TodayPlan } from '@/services/plan';
import { getPassedRank } from '@/services/progression';
import type { Rank } from '@/features/progression/leveling';
import { activeRest, applyPenance, type PenanceSnapshot } from '@/services/penance';
import type { RestPeriod } from '@/features/penance/engine';

/**
 * Caché en memoria del perfil activo. SQLite es la fuente de verdad:
 * después de cada escritura se llama a `refresh(db)`.
 */
interface ProfileState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  profile: Profile | null;
  latestMetric: BodyMetric | null;
  goals: Partial<Record<GoalType, Goal>>;
  totalXp: number;
  weekWorkouts: number;
  inProgress: Workout | null;
  /** Rutina asignada a hoy en el plan semanal. */
  today: TodayPlan | null;
  /** Rango general aprobado (examen de rango). */
  generalRank: Rank;
  /** Estado de la penitencia (se evalúa y aplica al refrescar). */
  penance: PenanceSnapshot | null;
  /** Modo descanso activo hoy. */
  rest: RestPeriod | null;
  /** Últimos fallos aplicados en este refresco (para avisar). */
  lastPenalties: PenanceSnapshot['applied'];
  refresh: (db: Db) => Promise<void>;
}

export const useProfileStore = create<ProfileState>((set) => ({
  status: 'idle',
  error: null,
  profile: null,
  latestMetric: null,
  goals: {},
  totalXp: 0,
  weekWorkouts: 0,
  inProgress: null,
  today: null,
  generalRank: 'E',
  penance: null,
  rest: null,
  lastPenalties: [],
  refresh: async (db) => {
    set((s) => ({ status: s.status === 'ready' ? 'ready' : 'loading' }));
    try {
      const profile = await profilesRepo.getActive(db);
      if (!profile) {
        set({ status: 'ready', error: null, profile: null, latestMetric: null, goals: {}, totalXp: 0, weekWorkouts: 0, inProgress: null, today: null, generalRank: 'E', penance: null, rest: null, lastPenalties: [] });
        return;
      }
      if (profile.onboardingCompletedAt) {
        await ensureDefaultPlan(db, profile.id);
        await applyPlanUpdates(db, profile.id);
        await backfillWorkoutEnergy(db, profile.id);
      }
      const penance = profile.onboardingCompletedAt ? await applyPenance(db, profile.id) : null;
      const rest = await activeRest(db, profile.id);
      const [latestMetric, goals, xp, week, inProgress, today, generalRank] = await Promise.all([
        bodyMetricsRepo.latest(db, profile.id),
        goalsRepo.listActive(db, profile.id),
        totalXp(db, profile.id),
        workoutsThisWeek(db, profile.id),
        workoutsRepo.getInProgress(db, profile.id),
        todayPlan(db, profile.id),
        getPassedRank(db, profile.id),
      ]);
      set({ status: 'ready', error: null, profile: (await profilesRepo.getById(db, profile.id)) ?? profile, latestMetric, goals, totalXp: xp, weekWorkouts: week, inProgress, today, generalRank, penance, rest, lastPenalties: penance?.applied ?? [] });
    } catch (e) {
      set({ status: 'error', error: e instanceof Error ? e.message : String(e) });
    }
  },
}));
