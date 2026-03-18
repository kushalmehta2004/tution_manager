import { z } from 'zod';

export const batchIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const listBatchesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional(),
  subject: z.string().trim().min(1).max(100).optional(),
  academicYear: z.string().trim().regex(/^\d{4}-\d{2}$/).optional(),
});

const timeStringSchema = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/);

export const createBatchSchema = z.object({
  name: z.string().trim().min(2).max(255),
  subject: z.string().trim().min(2).max(100),
  assignedFacultyId: z.string().uuid().optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
  startTime: timeStringSchema,
  endTime: timeStringSchema,
  room: z.string().trim().max(100).optional(),
  capacity: z.number().int().positive(),
  academicYear: z.string().trim().regex(/^\d{4}-\d{2}$/),
  colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export const updateBatchSchema = createBatchSchema.partial();

export const enrollStudentSchema = z.object({
  studentId: z.string().uuid(),
});

export const createHolidaySchema = z.object({
  date: z.coerce.date(),
  title: z.string().trim().min(2).max(255),
  batchId: z.string().uuid().optional(),
});

export const listHolidaysQuerySchema = z.object({
  batchId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type ListBatchesQuery = z.infer<typeof listBatchesQuerySchema>;
export type CreateBatchInput = z.infer<typeof createBatchSchema>;
export type UpdateBatchInput = z.infer<typeof updateBatchSchema>;
export type EnrollStudentInput = z.infer<typeof enrollStudentSchema>;
export type CreateHolidayInput = z.infer<typeof createHolidaySchema>;
export type ListHolidaysQuery = z.infer<typeof listHolidaysQuerySchema>;
