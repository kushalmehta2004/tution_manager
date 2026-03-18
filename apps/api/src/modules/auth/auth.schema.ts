import { z } from 'zod';

export const registerTeacherSchema = z.object({
  name: z.string().min(2).max(255),
  email: z.string().email(),
  phone: z.string().min(10).max(15),
  password: z.string().min(8).max(128),
  instituteName: z.string().min(2).max(500),
  city: z.string().min(2).max(100),
  subjectsTaught: z.array(z.string().min(2)).min(1),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

export type RegisterTeacherInput = z.infer<typeof registerTeacherSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
