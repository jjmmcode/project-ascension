import { z } from 'zod';

export const dataStatusSchema = z.enum(['confirmed', 'historical', 'estimated']);

export const profileInputSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'Escribe un nombre para tu personaje')
    .max(40, 'Máximo 40 caracteres'),
  heightCm: z.number().min(100, 'Altura mínima: 100 cm').max(250, 'Altura máxima: 250 cm').nullable(),
  heightStatus: dataStatusSchema.default('confirmed'),
  timezone: z.string().min(1).default('America/Santiago'),
});
export type ProfileInput = z.input<typeof profileInputSchema>;

export const PRIMARY_GOALS = [
  { value: 'recomposition', label: 'Recomposición' },
  { value: 'fat_loss', label: 'Reducir grasa' },
  { value: 'muscle_gain', label: 'Ganar músculo' },
  { value: 'performance', label: 'Fuerza y rendimiento' },
  { value: 'maintenance', label: 'Mantener' },
] as const;
export const primaryGoalSchema = z.enum(['recomposition', 'fat_loss', 'muscle_gain', 'performance', 'maintenance']);
export type PrimaryGoal = z.infer<typeof primaryGoalSchema>;
