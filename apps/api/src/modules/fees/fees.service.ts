import { PaymentMode, StudentFeeStatus, type Prisma } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { uploadBufferToStorage } from '../../config/storage.js';
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { sendWhatsAppMessage } from '../../services/messaging.js';
import type {
  AnnualSummaryQuery,
  CreateFeePaymentInput,
  DailyCollectionQuery,
  FeeReminderWebhookInput,
  ListStudentFeesQuery,
  MonthlyCollectionReportQuery,
  OutstandingReportQuery,
  SendFeeReminderInput,
  StudentLedgerQuery,
} from './fees.schema.js';

function toDateOnly(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function rupeesFromPaise(value: bigint | number): string {
  const paise = typeof value === 'bigint' ? Number(value) : value;
  return (paise / 100).toFixed(2);
}

function receiptNumber(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const unique = String(Date.now()).slice(-6);
  return `RCPT-${year}${month}${day}-${unique}`;
}

function bufferFromPdfDoc(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (error) => reject(error));
  });
}

async function createReceiptPdf(params: {
  receiptNumber: string;
  teacherName: string;
  studentName: string;
  studentCode: string;
  amountPaid: bigint;
  paymentDate: Date;
  paymentMode: PaymentMode;
  referenceNumber?: string;
}) {
  const doc = new PDFDocument({ margin: 48, size: 'A4' });
  const done = bufferFromPdfDoc(doc);

  doc.fontSize(18).text('Fee Payment Receipt', { underline: true });
  doc.moveDown(0.75);
  doc.fontSize(11).text(`Receipt No: ${params.receiptNumber}`);
  doc.text(`Date: ${params.paymentDate.toISOString().slice(0, 10)}`);
  doc.moveDown(0.75);
  doc.text(`Institute/Teacher: ${params.teacherName}`);
  doc.text(`Student: ${params.studentName} (${params.studentCode})`);
  doc.moveDown(0.75);
  doc.text(`Amount Paid: INR ${rupeesFromPaise(params.amountPaid)}`);
  doc.text(`Payment Mode: ${params.paymentMode}`);

  if (params.referenceNumber) {
    doc.text(`Reference No: ${params.referenceNumber}`);
  }

  doc.moveDown(1.2);
  doc.text('This is a system-generated receipt from Tuition Manager.');

  doc.end();
  return done;
}

async function computePaidTotal(tx: Prisma.TransactionClient, studentFeeId: string): Promise<bigint> {
  const aggregate = await tx.feePayment.aggregate({
    where: {
      student_fee_id: studentFeeId,
      deleted_at: null,
    },
    _sum: {
      amount_paid: true,
    },
  });

  return aggregate._sum.amount_paid ?? 0n;
}

async function reconcileOverdueStatuses(teacherId: string) {
  const today = toDateOnly(new Date());

  await prisma.studentFee.updateMany({
    where: {
      teacher_id: teacherId,
      deleted_at: null,
      status: {
        in: [StudentFeeStatus.pending, StudentFeeStatus.partial],
      },
      due_date: {
        lt: today,
      },
    },
    data: {
      status: StudentFeeStatus.overdue,
    },
  });
}

export async function listStudentFees(teacherId: string, query: ListStudentFeesQuery) {
  await reconcileOverdueStatuses(teacherId);

  const where: Prisma.StudentFeeWhereInput = {
    teacher_id: teacherId,
    deleted_at: null,
  };

  if (query.status) {
    where.status = query.status;
  }

  if (query.studentId) {
    where.student_id = query.studentId;
  }

  if (query.dueFrom || query.dueTo) {
    where.due_date = {
      gte: query.dueFrom ? toDateOnly(query.dueFrom) : undefined,
      lte: query.dueTo ? toDateOnly(query.dueTo) : undefined,
    };
  }

  if (query.search) {
    where.student = {
      deleted_at: null,
      OR: [
        { name: { contains: query.search, mode: 'insensitive' } },
        { student_code: { contains: query.search, mode: 'insensitive' } },
      ],
    };
  }

  const skip = (query.page - 1) * query.pageSize;

  const [rows, total] = await Promise.all([
    prisma.studentFee.findMany({
      where,
      skip,
      take: query.pageSize,
      orderBy: [{ due_date: 'asc' }, { created_at: 'desc' }],
      include: {
        student: {
          select: {
            id: true,
            name: true,
            student_code: true,
          },
        },
        fee_structure: {
          select: {
            id: true,
            name: true,
            frequency: true,
            subject: true,
          },
        },
      },
    }),
    prisma.studentFee.count({ where }),
  ]);

  const feeIds = rows.map((row) => row.id);
  const paymentSums = feeIds.length
    ? await prisma.feePayment.groupBy({
        by: ['student_fee_id'],
        where: {
          student_fee_id: { in: feeIds },
          deleted_at: null,
        },
        _sum: {
          amount_paid: true,
        },
      })
    : [];

  const paidLookup = new Map(
    paymentSums.map((row) => [row.student_fee_id, row._sum.amount_paid ?? 0n]),
  );

  return {
    data: rows.map((row) => {
      const amountDue = row.amount_due;
      const amountPaid = paidLookup.get(row.id) ?? 0n;
      const pending = amountDue - amountPaid;

      return {
        id: row.id,
        dueDate: row.due_date,
        amountDue: Number(amountDue),
        amountPaid: Number(amountPaid),
        amountPending: Number(pending > 0n ? pending : 0n),
        discountAmount: Number(row.discount_amount),
        discountReason: row.discount_reason,
        status: row.status,
        periodLabel: row.period_label,
        student: row.student,
        feeStructure: row.fee_structure,
      };
    }),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    },
  };
}

export async function createFeePayment(teacherId: string, input: CreateFeePaymentInput) {
  await reconcileOverdueStatuses(teacherId);

  const paymentDate = toDateOnly(input.paymentDate ?? new Date());

  return prisma.$transaction(async (tx) => {
    const studentFee = await tx.studentFee.findFirst({
      where: {
        id: input.studentFeeId,
        teacher_id: teacherId,
        deleted_at: null,
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            student_code: true,
          },
        },
        teacher: {
          select: {
            id: true,
            name: true,
            institute_name: true,
          },
        },
      },
    });

    if (!studentFee) {
      throw new Error('Student fee not found');
    }

    if (studentFee.status === StudentFeeStatus.waived) {
      throw new Error('Cannot record payment for waived fee');
    }

    const paidBefore = await computePaidTotal(tx, studentFee.id);
    const remainingBefore = studentFee.amount_due - paidBefore;

    if (remainingBefore <= 0n) {
      throw new Error('This fee is already fully paid');
    }

    const incoming = BigInt(input.amountPaid);
    if (incoming > remainingBefore) {
      throw new Error('Amount exceeds pending balance');
    }

    const nextPending = remainingBefore - incoming;
    const today = toDateOnly(new Date());
    let nextStatus: StudentFeeStatus = StudentFeeStatus.pending;

    if (nextPending === 0n) {
      nextStatus = StudentFeeStatus.paid;
    } else if (studentFee.due_date < today) {
      nextStatus = StudentFeeStatus.overdue;
    } else {
      nextStatus = StudentFeeStatus.partial;
    }

    const generatedReceiptNumber = receiptNumber(paymentDate);

    const createdPayment = await tx.feePayment.create({
      data: {
        student_fee_id: studentFee.id,
        student_id: studentFee.student_id,
        teacher_id: teacherId,
        amount_paid: incoming,
        payment_date: paymentDate,
        payment_mode: input.paymentMode,
        reference_number: input.referenceNumber,
        receipt_number: generatedReceiptNumber,
        notes: input.notes,
      },
    });

    const receiptPdf = await createReceiptPdf({
      receiptNumber: generatedReceiptNumber,
      teacherName: studentFee.teacher.institute_name || studentFee.teacher.name,
      studentName: studentFee.student.name,
      studentCode: studentFee.student.student_code,
      amountPaid: incoming,
      paymentDate,
      paymentMode: createdPayment.payment_mode,
      referenceNumber: input.referenceNumber,
    });

    let receiptUrl: string | null = null;
    try {
      const uploaded = await uploadBufferToStorage({
        keyPrefix: `fees/${studentFee.student_id}/receipts`,
        fileName: `${generatedReceiptNumber}.pdf`,
        contentType: 'application/pdf',
        body: receiptPdf,
      });
      receiptUrl = uploaded.url;
    } catch {
      receiptUrl = null;
    }

    const updatedPayment = await tx.feePayment.update({
      where: {
        id: createdPayment.id,
      },
      data: {
        receipt_url: receiptUrl,
      },
    });

    await tx.studentFee.update({
      where: {
        id: studentFee.id,
      },
      data: {
        status: nextStatus,
      },
    });

    return {
      payment: {
        id: updatedPayment.id,
        amountPaid: Number(updatedPayment.amount_paid),
        paymentDate: updatedPayment.payment_date,
        paymentMode: updatedPayment.payment_mode,
        referenceNumber: updatedPayment.reference_number,
        receiptNumber: updatedPayment.receipt_number,
        receiptUrl: updatedPayment.receipt_url,
      },
      studentFee: {
        id: studentFee.id,
        status: nextStatus,
        amountDue: Number(studentFee.amount_due),
        amountPaid: Number(paidBefore + incoming),
        amountPending: Number(nextPending),
      },
    };
  });
}

export async function getDailyCollectionSummary(teacherId: string, query: DailyCollectionQuery) {
  const date = toDateOnly(query.date ?? new Date());
  const nextDay = new Date(date);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);

  const rows = await prisma.feePayment.findMany({
    where: {
      teacher_id: teacherId,
      deleted_at: null,
      payment_date: {
        gte: date,
        lt: nextDay,
      },
    },
    select: {
      id: true,
      amount_paid: true,
      payment_mode: true,
    },
  });

  const byMode: Record<PaymentMode, number> = {
    cash: 0,
    upi: 0,
    bank_transfer: 0,
    cheque: 0,
    razorpay: 0,
    other: 0,
  };

  let totalCollected = 0;
  for (const row of rows) {
    const amount = Number(row.amount_paid);
    totalCollected += amount;
    byMode[row.payment_mode] += amount;
  }

  return {
    date,
    totalCollected,
    paymentCount: rows.length,
    byMode,
  };
}

const reminderDeliveryStatus = new Map<
  string,
  { status: 'sent' | 'delivered' | 'read' | 'failed'; providerMessageId?: string; updatedAt: string }
>();
const teacherReminderTemplateMap = new Map<string, string>();

function renderTemplate(template: string, variables: Record<string, string | number>): string {
  return Object.entries(variables).reduce((acc, [key, value]) => {
    return acc.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), String(value));
  }, template);
}

export async function sendFeeReminder(teacherId: string, input: SendFeeReminderInput) {
  const studentFee = await prisma.studentFee.findFirst({
    where: {
      id: input.studentFeeId,
      teacher_id: teacherId,
      deleted_at: null,
    },
    include: {
      student: {
        include: {
          parent: {
            select: {
              phone: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!studentFee) {
    throw new Error('Student fee not found');
  }

  const paidAgg = await prisma.feePayment.aggregate({
    where: {
      student_fee_id: studentFee.id,
      deleted_at: null,
    },
    _sum: {
      amount_paid: true,
    },
  });

  const pending = studentFee.amount_due - (paidAgg._sum.amount_paid ?? 0n);
  if (pending <= 0n) {
    throw new Error('No pending amount to remind');
  }

  const toPhone = studentFee.student.parent?.phone ?? studentFee.student.phone;
  if (!toPhone) {
    throw new Error('No phone number found for reminder');
  }

  if (input.messageTemplate) {
    teacherReminderTemplateMap.set(teacherId, input.messageTemplate);
  }

  const messageTemplate =
    input.messageTemplate ??
    teacherReminderTemplateMap.get(teacherId) ??
    env.FEE_REMINDER_DEFAULT_TEMPLATE;

  const messageText = renderTemplate(messageTemplate, {
    student_name: studentFee.student.name,
    amount: rupeesFromPaise(pending),
    due_date: studentFee.due_date.toISOString().slice(0, 10),
  });

  const delivery = await sendWhatsAppMessage({
    toPhone,
    body: messageText,
  });

  await prisma.studentFee.update({
    where: {
      id: studentFee.id,
    },
    data: {
      reminder_count: {
        increment: 1,
      },
      last_reminder_at: new Date(),
    },
  });

  reminderDeliveryStatus.set(studentFee.id, {
    status: 'sent',
    providerMessageId:
      typeof delivery === 'object' && delivery && 'providerMessageId' in delivery
        ? String((delivery as { providerMessageId?: string }).providerMessageId)
        : undefined,
    updatedAt: new Date().toISOString(),
  });

  return {
    studentFeeId: studentFee.id,
    channel: input.channel,
    pendingAmount: Number(pending),
    delivery,
  };
}

export async function applyFeeReminderWebhook(input: FeeReminderWebhookInput) {
  reminderDeliveryStatus.set(input.studentFeeId, {
    status: input.status,
    providerMessageId: input.providerMessageId,
    updatedAt: new Date().toISOString(),
  });

  return {
    ok: true,
    studentFeeId: input.studentFeeId,
    status: input.status,
  };
}

export async function runScheduledFeeReminders(teacherId?: string) {
  const today = toDateOnly(new Date());
  const threeDaysBefore = new Date(today);
  threeDaysBefore.setUTCDate(today.getUTCDate() + 3);
  const threeDaysAfter = new Date(today);
  threeDaysAfter.setUTCDate(today.getUTCDate() - 3);
  const sevenDaysAfter = new Date(today);
  sevenDaysAfter.setUTCDate(today.getUTCDate() - 7);

  const fees = await prisma.studentFee.findMany({
    where: {
      deleted_at: null,
      status: {
        in: [StudentFeeStatus.pending, StudentFeeStatus.partial, StudentFeeStatus.overdue],
      },
      ...(teacherId ? { teacher_id: teacherId } : {}),
      OR: [
        { due_date: threeDaysBefore },
        { due_date: today },
        { due_date: threeDaysAfter },
        { due_date: sevenDaysAfter },
      ],
    },
    select: {
      id: true,
      teacher_id: true,
    },
  });

  const results = await Promise.allSettled(
    fees.map((fee) =>
      sendFeeReminder(fee.teacher_id, {
        studentFeeId: fee.id,
        channel: 'whatsapp',
      }),
    ),
  );

  const sent = results.filter((result) => result.status === 'fulfilled').length;
  const failed = results.length - sent;

  return {
    total: results.length,
    sent,
    failed,
  };
}

function startOfMonth(month: string): Date {
  const [yearText, monthText] = month.split('-');
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  return new Date(Date.UTC(year, monthIndex, 1));
}

function monthFromDate(value: Date): string {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}`;
}

export async function getMonthlyCollectionReport(teacherId: string, query: MonthlyCollectionReportQuery) {
  const monthValue = query.month ?? monthFromDate(new Date());
  const monthStart = startOfMonth(monthValue);
  const monthEnd = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1));

  const [payments, dueFees] = await Promise.all([
    prisma.feePayment.findMany({
      where: {
        teacher_id: teacherId,
        deleted_at: null,
        payment_date: {
          gte: monthStart,
          lt: monthEnd,
        },
      },
      select: {
        amount_paid: true,
        payment_mode: true,
      },
    }),
    prisma.studentFee.findMany({
      where: {
        teacher_id: teacherId,
        deleted_at: null,
        due_date: {
          gte: monthStart,
          lt: monthEnd,
        },
      },
      select: {
        id: true,
        amount_due: true,
      },
    }),
  ]);

  const expectedTotal = dueFees.reduce((sum, row) => sum + Number(row.amount_due), 0);
  const collectedTotal = payments.reduce((sum, row) => sum + Number(row.amount_paid), 0);
  const pendingTotal = Math.max(expectedTotal - collectedTotal, 0);

  const byMode: Record<PaymentMode, number> = {
    cash: 0,
    upi: 0,
    bank_transfer: 0,
    cheque: 0,
    razorpay: 0,
    other: 0,
  };

  for (const payment of payments) {
    byMode[payment.payment_mode] += Number(payment.amount_paid);
  }

  return {
    month: monthValue,
    expectedTotal,
    collectedTotal,
    pendingTotal,
    byMode,
  };
}

export async function getStudentLedger(teacherId: string, query: StudentLedgerQuery) {
  const student = await prisma.student.findFirst({
    where: {
      id: query.studentId,
      teacher_id: teacherId,
      deleted_at: null,
    },
    select: {
      id: true,
      name: true,
      student_code: true,
    },
  });

  if (!student) {
    throw new Error('Student not found');
  }

  const [fees, payments] = await Promise.all([
    prisma.studentFee.findMany({
      where: {
        teacher_id: teacherId,
        student_id: student.id,
        deleted_at: null,
      },
      orderBy: [{ due_date: 'asc' }],
      include: {
        fee_structure: {
          select: {
            id: true,
            name: true,
            frequency: true,
          },
        },
      },
    }),
    prisma.feePayment.findMany({
      where: {
        teacher_id: teacherId,
        student_id: student.id,
        deleted_at: null,
      },
      orderBy: [{ payment_date: 'asc' }],
      select: {
        id: true,
        student_fee_id: true,
        amount_paid: true,
        payment_date: true,
        payment_mode: true,
        reference_number: true,
        receipt_url: true,
      },
    }),
  ]);

  const totalDue = fees.reduce((sum, row) => sum + Number(row.amount_due), 0);
  const totalPaid = payments.reduce((sum, row) => sum + Number(row.amount_paid), 0);

  return {
    student,
    summary: {
      totalDue,
      totalPaid,
      pending: Math.max(totalDue - totalPaid, 0),
    },
    fees: fees.map((row) => ({
      id: row.id,
      dueDate: row.due_date,
      amountDue: Number(row.amount_due),
      status: row.status,
      periodLabel: row.period_label,
      feeStructure: row.fee_structure,
    })),
    payments: payments.map((row) => ({
      id: row.id,
      studentFeeId: row.student_fee_id,
      amountPaid: Number(row.amount_paid),
      paymentDate: row.payment_date,
      paymentMode: row.payment_mode,
      referenceNumber: row.reference_number,
      receiptUrl: row.receipt_url,
    })),
  };
}

export async function getOutstandingFeesReport(teacherId: string, query: OutstandingReportQuery) {
  const asOfDate = toDateOnly(query.asOfDate ?? new Date());

  const fees = await prisma.studentFee.findMany({
    where: {
      teacher_id: teacherId,
      deleted_at: null,
      status: {
        in: [StudentFeeStatus.pending, StudentFeeStatus.partial, StudentFeeStatus.overdue],
      },
    },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          student_code: true,
        },
      },
    },
  });

  const feeIds = fees.map((row) => row.id);
  const paymentSums = feeIds.length
    ? await prisma.feePayment.groupBy({
        by: ['student_fee_id'],
        where: {
          student_fee_id: { in: feeIds },
          deleted_at: null,
        },
        _sum: {
          amount_paid: true,
        },
      })
    : [];

  const paidLookup = new Map(paymentSums.map((row) => [row.student_fee_id, row._sum.amount_paid ?? 0n]));

  const rows = fees
    .map((fee) => {
      const paid = paidLookup.get(fee.id) ?? 0n;
      const pending = fee.amount_due - paid;
      if (pending <= 0n) {
        return null;
      }

      const overdueDays = Math.max(
        Math.floor((asOfDate.getTime() - toDateOnly(fee.due_date).getTime()) / (1000 * 60 * 60 * 24)),
        0,
      );

      const bucket: '0-30' | '31-60' | '61-90' | '90+' =
        overdueDays > 90 ? '90+' : overdueDays > 60 ? '61-90' : overdueDays > 30 ? '31-60' : '0-30';

      return {
        studentFeeId: fee.id,
        studentId: fee.student.id,
        studentName: fee.student.name,
        studentCode: fee.student.student_code,
        dueDate: fee.due_date,
        amountPending: Number(pending),
        overdueDays,
        bucket,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => b.amountPending - a.amountPending);

  const ageing = {
    '0-30': 0,
    '31-60': 0,
    '61-90': 0,
    '90+': 0,
  };

  for (const row of rows) {
    ageing[row.bucket] += row.amountPending;
  }

  return {
    asOfDate,
    summary: {
      totalOutstanding: rows.reduce((sum, row) => sum + row.amountPending, 0),
      count: rows.length,
      ageing,
    },
    rows,
  };
}

export async function getAnnualFeeSummary(teacherId: string, query: AnnualSummaryQuery) {
  const defaultStartYear = new Date().getUTCMonth() >= 3 ? new Date().getUTCFullYear() : new Date().getUTCFullYear() - 1;
  const fy = query.financialYear ?? `${defaultStartYear}-${defaultStartYear + 1}`;
  const [startText, endText] = fy.split('-');
  const startYear = Number(startText);
  const endYear = Number(endText);

  const periodStart = new Date(Date.UTC(startYear, 3, 1));
  const periodEnd = new Date(Date.UTC(endYear, 2, 31));
  const periodEndExclusive = new Date(Date.UTC(endYear, 3, 1));

  const payments = await prisma.feePayment.findMany({
    where: {
      teacher_id: teacherId,
      deleted_at: null,
      payment_date: {
        gte: periodStart,
        lt: periodEndExclusive,
      },
    },
    select: {
      payment_date: true,
      amount_paid: true,
    },
  });

  const byMonth = new Map<string, number>();
  for (let i = 0; i < 12; i += 1) {
    const monthDate = new Date(Date.UTC(startYear, 3 + i, 1));
    byMonth.set(monthFromDate(monthDate), 0);
  }

  for (const row of payments) {
    const key = monthFromDate(row.payment_date);
    if (!byMonth.has(key)) {
      continue;
    }
    byMonth.set(key, (byMonth.get(key) ?? 0) + Number(row.amount_paid));
  }

  return {
    financialYear: fy,
    periodStart,
    periodEnd,
    totalCollected: payments.reduce((sum, row) => sum + Number(row.amount_paid), 0),
    monthly: Array.from(byMonth.entries()).map(([month, total]) => ({ month, total })),
  };
}