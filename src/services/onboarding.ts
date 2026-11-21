import type { Db } from '@/database/types';
import { transaction } from '@/database/transaction';
import { bodyMetricsRepo, goalsRepo, profilesRepo, settingsRepo, type Profile } from '@/database';
import { primaryGoalSchema, type PrimaryGoal } from '@/features/profile/schema';
import { localDateKey, nowIso } from '@/lib/time';

export const SETTING_PRIMARY_GOAL = 'primary_goal';

export interface OnboardingInput {
  displayName: string;
  heightCm: number | null;
  currentWeightKg: number | null;
  primaryGoal: PrimaryGoal;
  caloriesGoal: number | null;
  proteinGoalG: number | null;
  workoutsPerWeek: number;
  /** Opcional: se usa para la edad en el gasto energético. */
  birthYear?: number | null;
}

/**
 * Crea el perfil y sus datos iniciales en una sola transacción:
 * si cualquier validación falla, no queda nada a medias.
 */
export async function completeOnboarding(db: Db, input: OnboardingInput): Promise<Profile> {
  let profileId = '';
  const today = localDateKey();

  await transaction(db, async () => {
    const profile = await profilesRepo.create(db, {
      displayName: input.displayName,
      heightCm: input.heightCm,
      heightStatus: 'confirmed',
    });
    profileId = profile.id;

    await settingsRepo.set(db, profileId, SETTING_PRIMARY_GOAL, primaryGoalSchema, input.primaryGoal);

    await goalsRepo.setActive(db, profileId, {
      goalType: 'workouts_per_week',
      targetValue: input.workoutsPerWeek,
      startDate: today,
    });
    if (input.caloriesGoal !== null) {
      await goalsRepo.setActive(db, profileId, {
        goalType: 'calories',
        targetValue: input.caloriesGoal,
        startDate: today,
        notes: 'Meta declarada por el usuario; no es un requerimiento energético validado.',
      });
    }
    if (input.proteinGoalG !== null) {
      await goalsRepo.setActive(db, profileId, { goalType: 'protein_g', targetValue: input.proteinGoalG, startDate: today });
    }

    if (input.birthYear != null) await profilesRepo.setBirthYear(db, profileId, input.birthYear);
    if (input.currentWeightKg !== null) {
      await bodyMetricsRepo.create(db, profileId, {
        measuredAt: nowIso(),
        weightKg: input.currentWeightKg,
        source: 'manual',
        dataStatus: 'confirmed',
      });
    }

    await profilesRepo.completeOnboarding(db, profileId);
  });

  return (await profilesRepo.getById(db, profileId))!;
}

export const getPrimaryGoal = (db: Db, profileId: string) =>
  settingsRepo.get(db, profileId, SETTING_PRIMARY_GOAL, primaryGoalSchema);
