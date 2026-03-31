import type { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import {
  annualSummaryQuerySchema,
  createFeePaymentSchema,
  dailyCollectionQuerySchema,
  feeReminderWebhookSchema,
  listStudentFeesQuerySchema,
  monthlyCollectionReportQuerySchema,
  outstandingReportQuerySchema,
  sendFeeReminderSchema,
  studentLedgerQuerySchema,
} from './fees.schema.js';
import {
  applyFeeReminderWebhook,
  createFeePayment,
  getAnnualFeeSummary,
  getDailyCollectionSummary,
  getMonthlyCollectionReport,
  getOutstandingFeesReport,
  getStudentLedger,
  listStudentFees,
  sendFeeReminder,
} from './fees.service.js';

function requireTeacherId(req: Request, res: Response): string | null {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return null;
  }

  if (req.user.role !== 'teacher') {
    res.status(403).json({ message: 'Forbidden' });
    return null;
  }

  return req.user.sub;
}

export async function listStudentFeesHandler(req: Request, res: Response): Promise<void> {
  const teacherId = requireTeacherId(req, res);
  if (!teacherId) {
    return;
  }

  const parsed = listStudentFeesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid query params', errors: parsed.error.flatten() });
    return;
  }

  const result = await listStudentFees(teacherId, parsed.data);
  res.status(200).json(result);
}

export async function createFeePaymentHandler(req: Request, res: Response): Promise<void> {
  const teacherId = requireTeacherId(req, res);
  if (!teacherId) {
    return;
  }

  const parsed = createFeePaymentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid request body', errors: parsed.error.flatten() });
    return;
  }

  try {
    const result = await createFeePayment(teacherId, parsed.data);
    res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to record payment';
    const status = message === 'Student fee not found' ? 404 : 400;
    res.status(status).json({ message });
  }
}

export async function dailyCollectionSummaryHandler(req: Request, res: Response): Promise<void> {
  const teacherId = requireTeacherId(req, res);
  if (!teacherId) {
    return;
  }

  const parsed = dailyCollectionQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid query params', errors: parsed.error.flatten() });
    return;
  }

  const summary = await getDailyCollectionSummary(teacherId, parsed.data);
  res.status(200).json(summary);
}

export async function sendFeeReminderHandler(req: Request, res: Response): Promise<void> {
  const teacherId = requireTeacherId(req, res);
  if (!teacherId) {
    return;
  }

  const parsed = sendFeeReminderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid request body', errors: parsed.error.flatten() });
    return;
  }

  try {
    const result = await sendFeeReminder(teacherId, parsed.data);
    res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send fee reminder';
    const status = message === 'Student fee not found' ? 404 : 400;
    res.status(status).json({ message });
  }
}

export async function reminderWebhookHandler(req: Request, res: Response): Promise<void> {
  const parsed = feeReminderWebhookSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid request body', errors: parsed.error.flatten() });
    return;
  }

  const result = await applyFeeReminderWebhook(parsed.data);
  res.status(200).json(result);
}

export async function monthlyCollectionReportHandler(req: Request, res: Response): Promise<void> {
  const teacherId = requireTeacherId(req, res);
  if (!teacherId) {
    return;
  }

  const parsed = monthlyCollectionReportQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid query params', errors: parsed.error.flatten() });
    return;
  }

  const report = await getMonthlyCollectionReport(teacherId, parsed.data);
  res.status(200).json(report);
}

export async function studentLedgerHandler(req: Request, res: Response): Promise<void> {
  const teacherId = requireTeacherId(req, res);
  if (!teacherId) {
    return;
  }

  const parsed = studentLedgerQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid query params', errors: parsed.error.flatten() });
    return;
  }

  try {
    const report = await getStudentLedger(teacherId, parsed.data);
    res.status(200).json(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch ledger';
    const status = message === 'Student not found' ? 404 : 400;
    res.status(status).json({ message });
  }
}

export async function outstandingReportHandler(req: Request, res: Response): Promise<void> {
  const teacherId = requireTeacherId(req, res);
  if (!teacherId) {
    return;
  }

  const parsed = outstandingReportQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid query params', errors: parsed.error.flatten() });
    return;
  }

  const report = await getOutstandingFeesReport(teacherId, parsed.data);
  res.status(200).json(report);
}

export async function annualSummaryHandler(req: Request, res: Response): Promise<void> {
  const teacherId = requireTeacherId(req, res);
  if (!teacherId) {
    return;
  }

  const parsed = annualSummaryQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid query params', errors: parsed.error.flatten() });
    return;
  }

  const report = await getAnnualFeeSummary(teacherId, parsed.data);
  res.status(200).json(report);
}

export async function annualSummaryExportHandler(req: Request, res: Response): Promise<void> {
  const teacherId = requireTeacherId(req, res);
  if (!teacherId) {
    return;
  }

  const parsed = annualSummaryQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid query params', errors: parsed.error.flatten() });
    return;
  }

  const format = req.params.format;
  if (format !== 'pdf' && format !== 'excel') {
    res.status(400).json({ message: 'Invalid export format. Use pdf or excel.' });
    return;
  }

  const report = await getAnnualFeeSummary(teacherId, parsed.data);
  const fileBase = `annual-fee-summary-${report.financialYear}`;

  if (format === 'pdf') {
    res.attachment(`${fileBase}.pdf`);
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    doc.pipe(res);

    doc.fontSize(16).text('Annual Fee Summary', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Financial Year: ${report.financialYear}`);
    doc.text(`Total Collected: INR ${(report.totalCollected / 100).toFixed(2)}`);
    doc.moveDown();

    for (const row of report.monthly) {
      doc.text(`${row.month}: INR ${(row.total / 100).toFixed(2)}`);
    }

    doc.end();
    return;
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Annual Summary');

  sheet.columns = [
    { header: 'Month', key: 'month', width: 14 },
    { header: 'Collected (INR)', key: 'collectedInr', width: 18 },
  ];

  sheet.addRows(report.monthly.map((row) => ({ month: row.month, collectedInr: (row.total / 100).toFixed(2) })));
  sheet.addRow({ month: 'TOTAL', collectedInr: (report.totalCollected / 100).toFixed(2) });

  res.attachment(`${fileBase}.xlsx`);
  res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  await workbook.xlsx.write(res);
  res.end();
}