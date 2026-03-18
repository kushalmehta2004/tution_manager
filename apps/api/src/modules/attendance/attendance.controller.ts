import type { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { attendanceReportQuerySchema, getAttendanceQuerySchema, upsertAttendanceSchema } from './attendance.schema.js';
import { getAttendanceReport, getBatchAttendanceForDate, upsertBatchAttendance } from './attendance.service.js';

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

export async function getAttendanceHandler(req: Request, res: Response): Promise<void> {
  const teacherId = requireTeacherId(req, res);
  if (!teacherId) {
    return;
  }

  const parsed = getAttendanceQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid query params', errors: parsed.error.flatten() });
    return;
  }

  try {
    const result = await getBatchAttendanceForDate(teacherId, parsed.data);
    res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch attendance';
    const status = message === 'Batch not found' ? 404 : 400;
    res.status(status).json({ message });
  }
}

export async function upsertAttendanceHandler(req: Request, res: Response): Promise<void> {
  const teacherId = requireTeacherId(req, res);
  if (!teacherId) {
    return;
  }

  const parsed = upsertAttendanceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid request body', errors: parsed.error.flatten() });
    return;
  }

  try {
    const result = await upsertBatchAttendance(teacherId, parsed.data);
    res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save attendance';
    const status = message === 'Batch not found' ? 404 : 400;
    res.status(status).json({ message });
  }
}

type ExportFormat = 'pdf' | 'excel';

function isExportFormat(value: string): value is ExportFormat {
  return value === 'pdf' || value === 'excel';
}

function formatDateForFile(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export async function getAttendanceReportHandler(req: Request, res: Response): Promise<void> {
  const teacherId = requireTeacherId(req, res);
  if (!teacherId) {
    return;
  }

  const parsed = attendanceReportQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid query params', errors: parsed.error.flatten() });
    return;
  }

  try {
    const report = await getAttendanceReport(teacherId, parsed.data);
    res.status(200).json(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch attendance report';
    const status = message === 'Batch not found' || message === 'Student not found' ? 404 : 400;
    res.status(status).json({ message });
  }
}

export async function exportAttendanceReportHandler(req: Request, res: Response): Promise<void> {
  const teacherId = requireTeacherId(req, res);
  if (!teacherId) {
    return;
  }

  const format = req.params.format;
  if (!isExportFormat(format)) {
    res.status(400).json({ message: 'Invalid export format. Use pdf or excel.' });
    return;
  }

  const parsed = attendanceReportQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid query params', errors: parsed.error.flatten() });
    return;
  }

  try {
    const report = await getAttendanceReport(teacherId, parsed.data);
    const fromDate = formatDateForFile(report.filters.fromDate);
    const toDate = formatDateForFile(report.filters.toDate);
    const fileBase = `attendance-report-${fromDate}-to-${toDate}`;

    if (format === 'pdf') {
      res.attachment(`${fileBase}.pdf`);

      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      doc.pipe(res);

      doc.fontSize(16).text('Attendance Report', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10).text(`Date Range: ${fromDate} to ${toDate}`);
      doc.text(`Total Records: ${report.summary.totalRecords}`);
      doc.text(`Attendance %: ${report.summary.attendancePercent}%`);
      doc.text(
        `Status Counts: P ${report.summary.statusCounts.present} | A ${report.summary.statusCounts.absent} | L ${report.summary.statusCounts.late} | H ${report.summary.statusCounts.holiday} | C ${report.summary.statusCounts.cancelled}`,
      );
      doc.moveDown();

      for (const row of report.rows) {
        const line = `${formatDateForFile(row.date)} | ${row.batch.name} | ${row.student.name} (${row.student.student_code}) | ${row.status.toUpperCase()}${row.note ? ` | Note: ${row.note}` : ''}`;
        doc.fontSize(9).text(line, { width: 520 });
      }

      doc.end();
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Attendance Report');

    sheet.columns = [
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Batch', key: 'batch', width: 24 },
      { header: 'Subject', key: 'subject', width: 18 },
      { header: 'Student Code', key: 'studentCode', width: 16 },
      { header: 'Student Name', key: 'studentName', width: 24 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Note', key: 'note', width: 30 },
    ];

    sheet.addRows(
      report.rows.map((row) => ({
        date: formatDateForFile(row.date),
        batch: row.batch.name,
        subject: row.batch.subject,
        studentCode: row.student.student_code,
        studentName: row.student.name,
        status: row.status,
        note: row.note ?? '',
      })),
    );

    res.attachment(`${fileBase}.xlsx`);
    res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to export attendance report';
    const status = message === 'Batch not found' || message === 'Student not found' ? 404 : 400;
    res.status(status).json({ message });
  }
}
