import { z } from 'zod';

export const roleSchema = z.enum(['teacher', 'staff', 'parent']);
export type UserRole = z.infer<typeof roleSchema>;

export const teacherPlanSchema = z.enum(['free', 'starter', 'pro']);
export type TeacherPlan = z.infer<typeof teacherPlanSchema>;

export const authTokenPayloadSchema = z.object({
  sub: z.string().uuid(),
  role: roleSchema,
});

export type AuthTokenPayload = z.infer<typeof authTokenPayloadSchema>;
