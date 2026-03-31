import { z } from 'zod';

export const listStudentFeesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['pending', 'paid', 'partial', 'waived', 'overdue']).optional(),
  studentId: z.string().uuid().optional(),
  search: z.string().trim().min(1).optional(),
  dueFrom: z.coerce.date().optional(),
  dueTo: z.coerce.date().optional(),
});

export const createFeePaymentSchema = z.object({
  studentFeeId: z.string().uuid(),
  amountPaid: z.coerce.number().int().positive(),
  paymentDate: z.coerce.date().optional(),
  paymentMode: z.enum(['cash', 'upi', 'bank_transfer', 'cheque', 'razorpay', 'other']),
  referenceNumber: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const dailyCollectionQuerySchema = z.object({
  date: z.coerce.date().optional(),
});

export const sendFeeReminderSchema = z.object({
  studentFeeId: z.string().uuid(),
  channel: z.literal('whatsapp').default('whatsapp'),
  messageTemplate: z.string().trim().min(10).max(1000).optional(),
});

export const feeReminderWebhookSchema = z.object({
  studentFeeId: z.string().uuid(),
  status: z.enum(['sent', 'delivered', 'read', 'failed']),
  providerMessageId: z.string().trim().max(200).optional(),
});

export const monthlyCollectionReportQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'month must be YYYY-MM')
    .optional(),
});

export const studentLedgerQuerySchema = z.object({
  studentId: z.string().uuid(),
});

export const outstandingReportQuerySchema = z.object({
  asOfDate: z.coerce.date().optional(),
});

export const annualSummaryQuerySchema = z.object({
  financialYear: z
    .string()
    .regex(/^\d{4}-\d{4}$/, 'financialYear must be YYYY-YYYY')
    .optional(),
});

export type ListStudentFeesQuery = z.infer<typeof listStudentFeesQuerySchema>;
export type CreateFeePaymentInput = z.infer<typeof createFeePaymentSchema>;
export type DailyCollectionQuery = z.infer<typeof dailyCollectionQuerySchema>;
export type SendFeeReminderInput = z.infer<typeof sendFeeReminderSchema>;
export type FeeReminderWebhookInput = z.infer<typeof feeReminderWebhookSchema>;
export type MonthlyCollectionReportQuery = z.infer<typeof monthlyCollectionReportQuerySchema>;
export type StudentLedgerQuery = z.infer<typeof studentLedgerQuerySchema>;
export type OutstandingReportQuery = z.infer<typeof outstandingReportQuerySchema>;
export type AnnualSummaryQuery = z.infer<typeof annualSummaryQuerySchema>;