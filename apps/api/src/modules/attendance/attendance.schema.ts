import { z } from 'zod';

const attendanceEntrySchema = z.object({
  studentId: z.string().uuid(),
  status: z.enum(['present', 'absent', 'late']),
  note: z.string().trim().max(500).optional(),
});

export const upsertAttendanceSchema = z
  .object({
    batchId: z.string().uuid(),
    date: z.coerce.date(),
    entries: z.array(attendanceEntrySchema).min(1),
  })
  .refine(
    (value) => {
      const ids = value.entries.map((entry) => entry.studentId);
      return new Set(ids).size === ids.length;
    },
    {
      message: 'Duplicate student entries are not allowed',
      path: ['entries'],
    },
  );

export const getAttendanceQuerySchema = z.object({
  batch_id: z.string().uuid(),
  date: z.coerce.date(),
});

export const attendanceReportQuerySchema = z
  .object({
    batch_id: z.string().uuid().optional(),
    student_id: z.string().uuid().optional(),
    from_date: z.coerce.date(),
    to_date: z.coerce.date(),
  })
  .refine((value) => value.from_date <= value.to_date, {
    message: 'from_date must be before or equal to to_date',
    path: ['from_date'],
  });

export type UpsertAttendanceInput = z.infer<typeof upsertAttendanceSchema>;
export type GetAttendanceQuery = z.infer<typeof getAttendanceQuerySchema>;
export type AttendanceReportQuery = z.infer<typeof attendanceReportQuerySchema>;
