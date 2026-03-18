import { FeeFrequency, StudentFeeStatus, type Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { uploadBufferToStorage } from '../../config/storage.js';
import { sendParentInviteMessage } from '../../services/messaging.js';
import type {
  CreateStudentInput,
  EnrollStudentInput,
  ListStudentsQuery,
  ParentInviteInput,
  StudentAttendanceHeatmapQuery,
  UpdateStudentInput,
} from './students.schema.js';

type StudentDocumentItem = {
  type: 'aadhaar' | 'school_tc' | 'other';
  label?: string;
  url: string;
  uploadedAt: string;
};

function toDateOnly(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function parseMonthToUtcStart(monthValue?: string): Date {
  if (!monthValue) {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }

  const [yearText, monthText] = monthValue.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  return new Date(Date.UTC(year, month - 1, 1));
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function monthLabel(value: Date): string {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}`;
}

function statusPriority(status: 'present' | 'absent' | 'late' | 'holiday' | 'cancelled'): number {
  if (status === 'absent') {
    return 4;
  }

  if (status === 'late') {
    return 3;
  }

  if (status === 'present') {
    return 2;
  }

  if (status === 'holiday') {
    return 1;
  }

  return 0;
}

async function generateStudentCode(teacherId: string, year: number): Promise<string> {
  const prefix = `TM-${year}-`;

  const lastStudent = await prisma.student.findFirst({
    where: {
      teacher_id: teacherId,
      student_code: {
        startsWith: prefix,
      },
    },
    orderBy: {
      student_code: 'desc',
    },
    select: {
      student_code: true,
    },
  });

  const lastSequence = Number(lastStudent?.student_code.split('-')[2] ?? '0');
  const nextSequence = Number.isNaN(lastSequence) ? 1 : lastSequence + 1;

  return `${prefix}${String(nextSequence).padStart(3, '0')}`;
}

export async function listStudents(teacherId: string, query: ListStudentsQuery) {
  const where: Prisma.StudentWhereInput = {
    teacher_id: teacherId,
    deleted_at: null,
  };

  if (query.status) {
    where.status = query.status;
  }

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { student_code: { contains: query.search, mode: 'insensitive' } },
      { phone: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const skip = (query.page - 1) * query.pageSize;

  const [students, total] = await Promise.all([
    prisma.student.findMany({
      where,
      skip,
      take: query.pageSize,
      orderBy: {
        created_at: 'desc',
      },
      include: {
        batch_students: {
          where: {
            deleted_at: null,
            is_active: true,
            batch: {
              deleted_at: null,
            },
          },
          include: {
            batch: {
              select: {
                id: true,
                name: true,
                subject: true,
              },
            },
          },
        },
      },
    }),
    prisma.student.count({ where }),
  ]);

  return {
    data: students,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    },
  };
}

export async function createStudent(teacherId: string, input: CreateStudentInput) {
  const year = input.enrollmentDate.getUTCFullYear();
  const studentCode = await generateStudentCode(teacherId, year);

  return prisma.student.create({
    data: {
      teacher_id: teacherId,
      student_code: studentCode,
      name: input.name,
      phone: input.phone,
      date_of_birth: input.dateOfBirth ? toDateOnly(input.dateOfBirth) : undefined,
      class_grade: input.classGrade,
      school_college: input.schoolCollege,
      address: input.address,
      photo_url: input.photoUrl,
      enrollment_date: toDateOnly(input.enrollmentDate),
      status: input.status,
      notes: input.notes,
    },
  });
}

function addMonths(date: Date, months: number): Date {
  const value = new Date(date);
  value.setUTCMonth(value.getUTCMonth() + months);
  return value;
}

function addDays(date: Date, days: number): Date {
  const value = new Date(date);
  value.setUTCDate(value.getUTCDate() + days);
  return value;
}

function periodLabel(date: Date): string {
  const month = date.toLocaleString('en-IN', { month: 'short', timeZone: 'UTC' });
  return `${month}-${date.getUTCFullYear()}`;
}

function defaultPeriodsByFrequency(frequency: FeeFrequency): number {
  switch (frequency) {
    case FeeFrequency.monthly:
      return 12;
    case FeeFrequency.quarterly:
      return 4;
    case FeeFrequency.half_yearly:
      return 2;
    case FeeFrequency.annual:
    case FeeFrequency.one_time:
    case FeeFrequency.per_class:
      return 1;
    default:
      return 1;
  }
}

function dueDateByFrequency(startDate: Date, frequency: FeeFrequency, periodIndex: number): Date {
  switch (frequency) {
    case FeeFrequency.monthly:
      return addMonths(startDate, periodIndex);
    case FeeFrequency.quarterly:
      return addMonths(startDate, periodIndex * 3);
    case FeeFrequency.half_yearly:
      return addMonths(startDate, periodIndex * 6);
    case FeeFrequency.annual:
      return addMonths(startDate, periodIndex * 12);
    case FeeFrequency.one_time:
      return startDate;
    case FeeFrequency.per_class:
      return addDays(startDate, periodIndex * 7);
    default:
      return startDate;
  }
}

export async function enrollStudentWithFeeSchedule(teacherId: string, input: EnrollStudentInput) {
  const feeStructure = await prisma.feeStructure.findFirst({
    where: {
      id: input.feeStructureId,
      teacher_id: teacherId,
      deleted_at: null,
      is_active: true,
    },
    select: {
      id: true,
      amount: true,
      frequency: true,
    },
  });

  if (!feeStructure) {
    throw new Error('Fee structure not found');
  }

  const firstDueDate = toDateOnly(input.firstDueDate ?? input.enrollmentDate);
  const periodCount = input.feePeriods ?? defaultPeriodsByFrequency(feeStructure.frequency);
  const discountAmount = BigInt(input.discountAmount ?? 0);

  const year = input.enrollmentDate.getUTCFullYear();
  const studentCode = await generateStudentCode(teacherId, year);

  const student = await prisma.$transaction(async (tx) => {
    const created = await tx.student.create({
      data: {
        teacher_id: teacherId,
        student_code: studentCode,
        name: input.name,
        phone: input.phone,
        date_of_birth: input.dateOfBirth ? toDateOnly(input.dateOfBirth) : undefined,
        class_grade: input.classGrade,
        school_college: input.schoolCollege,
        address: input.address,
        photo_url: input.photoUrl,
        enrollment_date: toDateOnly(input.enrollmentDate),
        status: input.status,
        notes: input.notes,
      },
    });

    const amountDue = BigInt(feeStructure.amount) - discountAmount;

    const feeRows = Array.from({ length: periodCount }).map((_, index) => {
      const dueDate = toDateOnly(dueDateByFrequency(firstDueDate, feeStructure.frequency, index));

      return {
        student_id: created.id,
        teacher_id: teacherId,
        fee_structure_id: feeStructure.id,
        due_date: dueDate,
        amount_due: amountDue > 0n ? amountDue : 0n,
        discount_amount: discountAmount,
        discount_reason: input.discountReason,
        period_label: periodLabel(dueDate),
      };
    });

    await tx.studentFee.createMany({
      data: feeRows,
    });

    return created;
  });

  return {
    student,
    feeSchedule: {
      feeStructureId: feeStructure.id,
      periods: periodCount,
      firstDueDate,
    },
  };
}

export async function getStudentById(teacherId: string, studentId: string) {
  const student = await prisma.student.findFirst({
    where: {
      id: studentId,
      teacher_id: teacherId,
      deleted_at: null,
    },
    include: {
      parent: true,
      batch_students: {
        where: {
          deleted_at: null,
          is_active: true,
          batch: {
            deleted_at: null,
          },
        },
        include: {
          batch: true,
        },
      },
      student_fees: {
        where: {
          deleted_at: null,
        },
        select: {
          status: true,
          amount_due: true,
        },
      },
      test_results: {
        where: {
          deleted_at: null,
          test: {
            deleted_at: null,
          },
        },
        include: {
          test: {
            select: {
              id: true,
              title: true,
              subject: true,
              test_date: true,
            },
          },
        },
        orderBy: {
          test: {
            test_date: 'desc',
          },
        },
      },
    },
  });

  if (!student) {
    throw new Error('Student not found');
  }

  const feeSummary = student.student_fees.reduce(
    (summary, fee) => {
      const amountDue = Number(fee.amount_due);
      summary.totalAmountDue += amountDue;

      if (
        fee.status === StudentFeeStatus.pending ||
        fee.status === StudentFeeStatus.partial ||
        fee.status === StudentFeeStatus.overdue
      ) {
        summary.pendingAmount += amountDue;
      }

      return summary;
    },
    {
      totalAmountDue: 0,
      pendingAmount: 0,
    },
  );

  const attendanceRows = await prisma.attendance.findMany({
    where: {
      student_id: student.id,
      deleted_at: null,
    },
    select: {
      status: true,
    },
  });

  const attendanceSummary = attendanceRows.reduce(
    (summary, row) => {
      if (row.status === 'present') {
        summary.present += 1;
        summary.totalMarked += 1;
      }

      if (row.status === 'late') {
        summary.late += 1;
        summary.totalMarked += 1;
      }

      if (row.status === 'absent') {
        summary.absent += 1;
        summary.totalMarked += 1;
      }

      if (row.status === 'holiday') {
        summary.holiday += 1;
      }

      return summary;
    },
    {
      present: 0,
      absent: 0,
      late: 0,
      holiday: 0,
      totalMarked: 0,
      attendancePercent: 0,
      lowAttendanceAlert: false,
    },
  );

  const presentOrLate = attendanceSummary.present + attendanceSummary.late;
  attendanceSummary.attendancePercent =
    attendanceSummary.totalMarked > 0
      ? Math.round((presentOrLate / attendanceSummary.totalMarked) * 100)
      : 0;
  attendanceSummary.lowAttendanceAlert =
    attendanceSummary.totalMarked > 0 && attendanceSummary.attendancePercent < 75;

  return {
    ...student,
    feeSummary,
    attendanceSummary,
  };
}

export async function getStudentAttendanceHeatmap(
  teacherId: string,
  studentId: string,
  query: StudentAttendanceHeatmapQuery,
) {
  const student = await prisma.student.findFirst({
    where: {
      id: studentId,
      teacher_id: teacherId,
      deleted_at: null,
    },
    select: {
      id: true,
      student_code: true,
      name: true,
      batch_students: {
        where: {
          deleted_at: null,
          is_active: true,
        },
        select: {
          batch_id: true,
        },
      },
    },
  });

  if (!student) {
    throw new Error('Student not found');
  }

  const monthStart = parseMonthToUtcStart(query.month);
  const monthEnd = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0));
  const batchIds = student.batch_students.map((row) => row.batch_id);

  const [attendanceRows, holidayRows] = await Promise.all([
    prisma.attendance.findMany({
      where: {
        student_id: student.id,
        deleted_at: null,
        date: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      select: {
        date: true,
        status: true,
      },
    }),
    prisma.holiday.findMany({
      where: {
        teacher_id: teacherId,
        deleted_at: null,
        date: {
          gte: monthStart,
          lte: monthEnd,
        },
        OR: [
          { batch_id: null },
          ...(batchIds.length > 0 ? [{ batch_id: { in: batchIds } }] : []),
        ],
      },
      select: {
        date: true,
      },
    }),
  ]);

  const dayStatus = new Map<string, 'present' | 'absent' | 'late' | 'holiday' | 'cancelled'>();

  for (const holiday of holidayRows) {
    dayStatus.set(toIsoDate(holiday.date), 'holiday');
  }

  for (const attendance of attendanceRows) {
    const key = toIsoDate(attendance.date);
    const current = dayStatus.get(key);
    if (!current || statusPriority(attendance.status) >= statusPriority(current)) {
      dayStatus.set(key, attendance.status);
    }
  }

  const daysInMonth = monthEnd.getUTCDate();
  const days = Array.from({ length: daysInMonth }).map((_, index) => {
    const date = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), index + 1));
    const dateKey = toIsoDate(date);

    const status = dayStatus.get(dateKey) ?? null;

    return {
      date: dateKey,
      dayOfMonth: index + 1,
      dayOfWeek: date.getUTCDay(),
      status,
    };
  });

  const summary = days.reduce(
    (accumulator, day) => {
      if (day.status === 'present') {
        accumulator.present += 1;
      }

      if (day.status === 'absent') {
        accumulator.absent += 1;
      }

      if (day.status === 'late') {
        accumulator.late += 1;
      }

      if (day.status === 'holiday') {
        accumulator.holiday += 1;
      }

      if (day.status === 'cancelled') {
        accumulator.cancelled += 1;
      }

      if (day.status !== null) {
        accumulator.markedDays += 1;
      }

      return accumulator;
    },
    {
      markedDays: 0,
      present: 0,
      absent: 0,
      late: 0,
      holiday: 0,
      cancelled: 0,
    },
  );

  return {
    student: {
      id: student.id,
      studentCode: student.student_code,
      name: student.name,
    },
    month: monthLabel(monthStart),
    monthStart: toIsoDate(monthStart),
    monthEnd: toIsoDate(monthEnd),
    days,
    summary,
  };
}

export async function updateStudentById(
  teacherId: string,
  studentId: string,
  input: UpdateStudentInput,
) {
  const existing = await prisma.student.findFirst({
    where: {
      id: studentId,
      teacher_id: teacherId,
      deleted_at: null,
    },
    select: {
      id: true,
    },
  });

  if (!existing) {
    throw new Error('Student not found');
  }

  return prisma.student.update({
    where: {
      id: existing.id,
    },
    data: {
      name: input.name,
      phone: input.phone,
      date_of_birth: input.dateOfBirth ? toDateOnly(input.dateOfBirth) : input.dateOfBirth,
      class_grade: input.classGrade,
      school_college: input.schoolCollege,
      address: input.address,
      photo_url: input.photoUrl,
      enrollment_date: input.enrollmentDate ? toDateOnly(input.enrollmentDate) : input.enrollmentDate,
      status: input.status,
      notes: input.notes,
    },
  });
}

export async function softDeleteStudentById(teacherId: string, studentId: string) {
  const existing = await prisma.student.findFirst({
    where: {
      id: studentId,
      teacher_id: teacherId,
      deleted_at: null,
    },
    select: {
      id: true,
    },
  });

  if (!existing) {
    throw new Error('Student not found');
  }

  return prisma.student.update({
    where: {
      id: existing.id,
    },
    data: {
      deleted_at: new Date(),
      status: 'inactive',
    },
  });
}

export async function uploadStudentPhoto(
  teacherId: string,
  studentId: string,
  file: { originalname: string; mimetype: string; buffer: Buffer },
) {
  const existing = await prisma.student.findFirst({
    where: {
      id: studentId,
      teacher_id: teacherId,
      deleted_at: null,
    },
    select: {
      id: true,
    },
  });

  if (!existing) {
    throw new Error('Student not found');
  }

  const uploaded = await uploadBufferToStorage({
    keyPrefix: `students/${studentId}/photos`,
    fileName: file.originalname,
    contentType: file.mimetype,
    body: file.buffer,
  });

  const student = await prisma.student.update({
    where: {
      id: studentId,
    },
    data: {
      photo_url: uploaded.url,
    },
  });

  return {
    photoUrl: student.photo_url,
  };
}

export async function uploadStudentDocument(
  teacherId: string,
  studentId: string,
  input: { type: 'aadhaar' | 'school_tc' | 'other'; label?: string },
  file: { originalname: string; mimetype: string; buffer: Buffer },
) {
  const existing = await prisma.student.findFirst({
    where: {
      id: studentId,
      teacher_id: teacherId,
      deleted_at: null,
    },
    select: {
      id: true,
      document_urls: true,
    },
  });

  if (!existing) {
    throw new Error('Student not found');
  }

  const uploaded = await uploadBufferToStorage({
    keyPrefix: `students/${studentId}/documents`,
    fileName: file.originalname,
    contentType: file.mimetype,
    body: file.buffer,
  });

  const currentDocuments = (Array.isArray(existing.document_urls)
    ? existing.document_urls
    : []) as StudentDocumentItem[];

  const nextDocument: StudentDocumentItem = {
    type: input.type,
    label: input.label,
    url: uploaded.url,
    uploadedAt: new Date().toISOString(),
  };

  const student = await prisma.student.update({
    where: {
      id: studentId,
    },
    data: {
      document_urls: [...currentDocuments, nextDocument],
    },
    select: {
      id: true,
      document_urls: true,
    },
  });

  return {
    studentId: student.id,
    documents: student.document_urls,
  };
}

export async function createParentInvite(teacherId: string, studentId: string, input: ParentInviteInput) {
  const student = await prisma.student.findFirst({
    where: {
      id: studentId,
      teacher_id: teacherId,
      deleted_at: null,
    },
    select: {
      id: true,
      name: true,
      parent: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!student) {
    throw new Error('Student not found');
  }

  const phoneOwner = await prisma.parent.findFirst({
    where: {
      phone: input.parentPhone,
      deleted_at: null,
      NOT: {
        student_id: student.id,
      },
    },
    select: {
      id: true,
    },
  });

  if (phoneOwner) {
    throw new Error('Phone already linked to another student');
  }

  const temporaryPasswordHash = await bcrypt.hash(`invite-${student.id}`, env.BCRYPT_SALT_ROUNDS);

  await prisma.parent.upsert({
    where: {
      student_id: student.id,
    },
    update: {
      name: input.parentName,
      phone: input.parentPhone,
      relation: input.relation,
      email: input.email,
    },
    create: {
      student_id: student.id,
      name: input.parentName,
      phone: input.parentPhone,
      relation: input.relation,
      email: input.email,
      password_hash: temporaryPasswordHash,
    },
  });

  const inviteToken = jwt.sign(
    {
      sub: student.id,
      phone: input.parentPhone,
      role: 'parent',
      type: 'parent_invite',
    },
    env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' },
  );

  const inviteLink = `${env.PARENT_INVITE_BASE_URL}?token=${inviteToken}`;
  const messageText = `Hi ${input.parentName}, you have been invited to Tuition Manager for ${student.name}. Complete your parent setup here: ${inviteLink}`;
  const delivery = await sendParentInviteMessage({
    toPhone: input.parentPhone,
    body: messageText,
  });

  return {
    studentId: student.id,
    studentName: student.name,
    channel: input.channel,
    inviteLink,
    delivery,
  };
}
