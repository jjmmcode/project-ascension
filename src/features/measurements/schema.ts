import { z } from 'zod';
import { dataStatusSchema } from '@/features/profile/schema';

const optionalRange = (min: number, max: number, label: string) =>
  z
    .number()
    .min(min, `${label}: mínimo ${min}`)
    .max(max, `${label}: máximo ${max}`)
    .nullable()
    .default(null);

export const measurementSourceSchema = z.enum(['manual', 'scale', 'inbody', 'import']);

export const bodyMetricInputSchema = z
  .object({
    measuredAt: z.iso.datetime({ message: 'Fecha inválida' }),
    weightKg: optionalRange(30, 300, 'Peso'),
    waistCm: optionalRange(40, 200, 'Cintura'),
    bodyFatPercentage: optionalRange(2, 70, '% grasa'),
    skeletalMuscleKg: optionalRange(5, 100, 'Masa muscular'),
    bodyFatKg: optionalRange(1, 200, 'Masa grasa'),
    bmrKcal: optionalRange(500, 5000, 'Metabolismo basal'),
    source: measurementSourceSchema,
    dataStatus: dataStatusSchema.default('confirmed'),
    notes: z.string().trim().max(500).nullable().default(null),
  })
  .refine(
    (m) =>
      [m.weightKg, m.waistCm, m.bodyFatPercentage, m.skeletalMuscleKg, m.bodyFatKg, m.bmrKcal].some(
        (v) => v !== null,
      ),
    { message: 'Registra al menos un valor' },
  )
  .refine((m) => new Date(m.measuredAt).getTime() <= Date.now() + 60_000, {
    message: 'La fecha no puede estar en el futuro',
    path: ['measuredAt'],
  });

export type BodyMetricInput = z.input<typeof bodyMetricInputSchema>;
