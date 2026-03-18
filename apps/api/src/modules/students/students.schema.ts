import { StudentStatus } from '@prisma/client';
import { z } from 'zod';

export const studentIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const studentAttendanceHeatmapQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'month must be in YYYY-MM format')
    .optional(),
});

export const studentDocumentUploadSchema = z.object({
  type: z.enum(['aadhaar', 'school_tc', 'other']).default('other'),
  label: z.string().trim().min(1).max(100).optional(),
});

export const parentInviteSchema = z.object({
  parentName: z.string().trim().min(2).max(255),
  parentPhone: z.string().trim().min(10).max(15),
  relation: z.enum(['father', 'mother', 'guardian']),
  email: z.string().email().optional(),
  channel: z.literal('whatsapp').default('whatsapp'),
});

export const listStudentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional(),
  status: z.nativeEnum(StudentStatus).optional(),
});

export const createStudentSchema = z.object({
  name: z.string().trim().min(2).max(255),
  phone: z.string().trim().min(10).max(15).optional(),
  dateOfBirth: z.coerce.date().optional(),
  classGrade: z.string().trim().min(1).max(20),
  schoolCollege: z.string().trim().max(255).optional(),
  address: z.string().trim().max(2000).optional(),
  photoUrl: z.string().url().optional(),
  enrollmentDate: z.coerce.date(),
  status: z.nativeEnum(StudentStatus).optional(),
  notes: z.string().trim().max(5000).optional(),
});

export const updateStudentSchema = createStudentSchema
  .omit({ enrollmentDate: true })
  .extend({
    enrollmentDate: z.coerce.date().optional(),
  })
  .partial();

export const enrollStudentSchema = createStudentSchema.extend({
  feeStructureId: z.string().uuid(),
  feePeriods: z.coerce.number().int().min(1).max(36).optional(),
  firstDueDate: z.coerce.date().optional(),
  discountAmount: z.coerce.number().int().min(0).optional(),
  discountReason: z.string().trim().max(255).optional(),
});

export type ListStudentsQuery = z.infer<typeof listStudentsQuerySchema>;
export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
export type StudentDocumentUploadInput = z.infer<typeof studentDocumentUploadSchema>;
export type EnrollStudentInput = z.infer<typeof enrollStudentSchema>;
export type ParentInviteInput = z.infer<typeof parentInviteSchema>;
export type StudentAttendanceHeatmapQuery = z.infer<typeof studentAttendanceHeatmapQuerySchema>;
