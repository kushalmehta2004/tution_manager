import { z } from 'zod';

const feeFrequencySchema = z.enum([
  'monthly',
  'quarterly',
  'half_yearly',
  'annual',
  'one_time',
  'per_class',
]);

export const feeStructureIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const createFeeStructureSchema = z.object({
  name: z.string().trim().min(2).max(255),
  amount: z.coerce.number().int().positive(),
  frequency: feeFrequencySchema,
  subject: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().min(1).optional(),
  isActive: z.coerce.boolean().default(true),
});

export const updateFeeStructureSchema = createFeeStructureSchema.partial();

export type CreateFeeStructureInput = z.infer<typeof createFeeStructureSchema>;
export type UpdateFeeStructureInput = z.infer<typeof updateFeeStructureSchema>;