import { prisma } from '../../config/prisma.js';
import type { AttendanceReportQuery, GetAttendanceQuery, UpsertAttendanceInput } from './attendance.schema.js';

function toDateOnly(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

async function ensureOwnedBatch(teacherId: string, batchId: string) {
  const batch = await prisma.batch.findFirst({
    where: {
      id: batchId,
      teacher_id: teacherId,
      deleted_at: null,
    },
    select: {
      id: true,
      name: true,
      subject: true,
    },
  });

  if (!batch) {
    throw new Error('Batch not found');
  }

  return batch;
}

async function getActiveBatchStudentIds(batchId: string) {
  const enrollments = await prisma.batchStudent.findMany({
    where: {
      batch_id: batchId,
      deleted_at: null,
      is_active: true,
      student: {
        deleted_at: null,
      },
    },
    select: {
      student_id: true,
    },
  });

  return new Set(enrollments.map((row) => row.student_id));
}

export async function getBatchAttendanceForDate(teacherId: string, query: GetAttendanceQuery) {
  const batch = await ensureOwnedBatch(teacherId, query.batch_id);
  const date = toDateOnly(query.date);

  const [enrollments, attendanceRows] = await Promise.all([
    prisma.batchStudent.findMany({
      where: {
        batch_id: query.batch_id,
        deleted_at: null,
        is_active: true,
        student: {
          deleted_at: null,
        },
      },
      include: {
        student: {
          select: {
            id: true,
            student_code: true,
            name: true,
            status: true,
          },
        },
      },
      orderBy: {
        created_at: 'asc',
      },
    }),
    prisma.attendance.findMany({
      where: {
        batch_id: query.batch_id,
        date,
        deleted_at: null,
      },
      select: {
        student_id: true,
        status: true,
        note: true,
        marked_at: true,
      },
    }),
  ]);

  const attendanceMap = new Map(attendanceRows.map((row) => [row.student_id, row]));

  const students = enrollments.map((row) => {
    const marked = attendanceMap.get(row.student.id);

    return {
      studentId: row.student.id,
      studentCode: row.student.student_code,
      name: row.student.name,
      profileStatus: row.student.status,
      status: marked?.status ?? null,
      note: marked?.note ?? null,
      markedAt: marked?.marked_at ?? null,
    };
  });

  return {
    batch,
    date,
    mode: attendanceRows.length > 0 ? 'edit' : 'create',
    students,
  };
}

export async function upsertBatchAttendance(teacherId: string, input: UpsertAttendanceInput) {
  await ensureOwnedBatch(teacherId, input.batchId);

  const activeStudentIds = await getActiveBatchStudentIds(input.batchId);
  if (activeStudentIds.size === 0) {
    throw new Error('No active students in this batch');
  }

  for (const entry of input.entries) {
    if (!activeStudentIds.has(entry.studentId)) {
      throw new Error('One or more students are not active in this batch');
    }
  }

  const date = toDateOnly(input.date);

  return prisma.$transaction(async (tx) => {
    const existingRows = await tx.attendance.findMany({
      where: {
        batch_id: input.batchId,
        date,
        deleted_at: null,
      },
      select: {
        student_id: true,
      },
    });

    const existingStudentIds = new Set(existingRows.map((row) => row.student_id));
    let createdCount = 0;
    let updatedCount = 0;

    for (const entry of input.entries) {
      const alreadyExists = existingStudentIds.has(entry.studentId);

      await tx.attendance.upsert({
        where: {
          batch_id_student_id_date: {
            batch_id: input.batchId,
            student_id: entry.studentId,
            date,
          },
        },
        update: {
          status: entry.status,
          note: entry.note,
          marked_by: teacherId,
          marked_at: new Date(),
          deleted_at: null,
        },
        create: {
          batch_id: input.batchId,
          student_id: entry.studentId,
          date,
          status: entry.status,
          note: entry.note,
          marked_by: teacherId,
          marked_at: new Date(),
        },
      });

      if (alreadyExists) {
        updatedCount += 1;
      } else {
        createdCount += 1;
      }
    }

    return {
      batchId: input.batchId,
      date,
      mode: existingRows.length > 0 ? 'edit' : 'create',
      summary: {
        submitted: input.entries.length,
        created: createdCount,
        updated: updatedCount,
      },
    };
  });
}

export async function getAttendanceReport(teacherId: string, query: AttendanceReportQuery) {
  const fromDate = toDateOnly(query.from_date);
  const toDate = toDateOnly(query.to_date);

  if (query.batch_id) {
    await ensureOwnedBatch(teacherId, query.batch_id);
  }

  if (query.student_id) {
    const student = await prisma.student.findFirst({
      where: {
        id: query.student_id,
        teacher_id: teacherId,
        deleted_at: null,
      },
      select: {
        id: true,
      },
    });

    if (!student) {
      throw new Error('Student not found');
    }
  }

  const attendanceRows = await prisma.attendance.findMany({
    where: {
      deleted_at: null,
      batch: {
        teacher_id: teacherId,
        deleted_at: null,
      },
      ...(query.batch_id ? { batch_id: query.batch_id } : {}),
      ...(query.student_id ? { student_id: query.student_id } : {}),
      date: {
        gte: fromDate,
        lte: toDate,
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
      student: {
        select: {
          id: true,
          student_code: true,
          name: true,
        },
      },
    },
    orderBy: [{ date: 'asc' }, { batch_id: 'asc' }, { student_id: 'asc' }],
  });

  const statusCounts = {
    present: 0,
    absent: 0,
    late: 0,
    holiday: 0,
    cancelled: 0,
  };

  for (const row of attendanceRows) {
    statusCounts[row.status] += 1;
  }

  const markedTotal = attendanceRows.length;
  const attendedTotal = statusCounts.present + statusCounts.late;
  const attendancePercent = markedTotal > 0 ? Number(((attendedTotal / markedTotal) * 100).toFixed(1)) : 0;

  const rows = attendanceRows.map((row) => ({
    id: row.id,
    date: row.date,
    status: row.status,
    note: row.note,
    markedAt: row.marked_at,
    batch: row.batch,
    student: row.student,
  }));

  return {
    filters: {
      batchId: query.batch_id ?? null,
      studentId: query.student_id ?? null,
      fromDate,
      toDate,
    },
    summary: {
      totalRecords: markedTotal,
      attendancePercent,
      statusCounts,
    },
    rows,
  };
}
