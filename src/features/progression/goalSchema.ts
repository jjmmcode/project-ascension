import { z } from 'zod';
import { dataStatusSchema } from '@/features/profile/schema';

/** Rangos plausibles por tipo. Fuera de ellos se rechaza: no son recomendaciones. */
export const GOAL_TYPES = {
  calories: { unit: 'kcal', min: 800, max: 6000, label: 'Calorías diarias' },
  protein_g: { unit: 'g', min: 0, max: 400, label: 'Proteína diaria' },
  carbs_g: { unit: 'g', min: 0, max: 900, label: 'Carbohidratos diarios' },
  fat_g: { unit: 'g', min: 0, max: 400, label: 'Grasas diarias' },
  water_ml: { unit: 'ml', min: 250, max: 8000, label: 'Agua diaria' },
  workouts_per_week: { unit: 'sessions', min: 1, max: 7, label: 'Entrenamientos por semana' },
  weight_kg: { unit: 'kg', min: 30, max: 300, label: 'Peso objetivo' },
} as const;

export type GoalType = keyof typeof GOAL_TYPES;
export const goalTypeSchema = z.enum(Object.keys(GOAL_TYPES) as [GoalType, ...GoalType[]]);

export const goalInputSchema = z
  .object({
    goalType: goalTypeSchema,
    targetValue: z.number().finite(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha YYYY-MM-DD'),
    targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
    dataStatus: dataStatusSchema.default('confirmed'),
    notes: z.string().trim().max(500).nullable().default(null),
  })
  .superRefine((g, ctx) => {
    const spec = GOAL_TYPES[g.goalType];
    if (g.targetValue < spec.min || g.targetValue > spec.max) {
      ctx.addIssue({
        code: 'custom',
        path: ['targetValue'],
        message: `${spec.label}: entre ${spec.min} y ${spec.max} ${spec.unit}`,
      });
    }
  });

export type GoalInput = z.input<typeof goalInputSchema>;
