import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import type {
  CreateBatchInput,
  CreateHolidayInput,
  EnrollStudentInput,
  ListBatchesQuery,
  ListHolidaysQuery,
  UpdateBatchInput,
} from './batches.schema.js';

function toDateOnly(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function timeToDate(time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export async function listBatches(teacherId: string, query: ListBatchesQuery) {
  const where: Prisma.BatchWhereInput = {
    teacher_id: teacherId,
    deleted_at: null,
  };

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { subject: { contains: query.search, mode: 'insensitive' } },
      { room: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  if (query.subject) {
    where.subject = { equals: query.subject, mode: 'insensitive' };
  }

  if (query.academicYear) {
    where.academic_year = query.academicYear;
  }

  const skip = (query.page - 1) * query.pageSize;

  const [batches, total] = await Promise.all([
    prisma.batch.findMany({
      where,
      skip,
      take: query.pageSize,
      orderBy: {
        created_at: 'desc',
      },
      include: {
        assigned_staff: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            batch_students: {
              where: {
                deleted_at: null,
                is_active: true,
                student: {
                  deleted_at: null,
                },
              },
            },
          },
        },
      },
    }),
    prisma.batch.count({ where }),
  ]);

  const data = batches.map((batch) => {
    const activeStudentCount = batch._count.batch_students;
    const occupancyPercent = batch.capacity > 0 ? Math.round((activeStudentCount / batch.capacity) * 100) : 0;

    return {
      ...batch,
      activeStudentCount,
      occupancyPercent,
      capacityAlert: occupancyPercent >= 90,
    };
  });

  return {
    data,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    },
  };
}

export async function createBatch(teacherId: string, input: CreateBatchInput) {
  return prisma.batch.create({
    data: {
      teacher_id: teacherId,
      name: input.name,
      subject: input.subject,
      assigned_faculty_id: input.assignedFacultyId,
      days_of_week: input.daysOfWeek,
      start_time: timeToDate(input.startTime),
      end_time: timeToDate(input.endTime),
      room: input.room,
      capacity: input.capacity,
      academic_year: input.academicYear,
      color_hex: input.colorHex,
    },
  });
}

export async function updateBatchById(teacherId: string, batchId: string, input: UpdateBatchInput) {
  const existing = await prisma.batch.findFirst({
    where: {
      id: batchId,
      teacher_id: teacherId,
      deleted_at: null,
    },
    select: {
      id: true,
    },
  });

  if (!existing) {
    throw new Error('Batch not found');
  }

  return prisma.batch.update({
    where: {
      id: existing.id,
    },
    data: {
      name: input.name,
      subject: input.subject,
      assigned_faculty_id: input.assignedFacultyId,
      days_of_week: input.daysOfWeek,
      start_time: input.startTime ? timeToDate(input.startTime) : undefined,
      end_time: input.endTime ? timeToDate(input.endTime) : undefined,
      room: input.room,
      capacity: input.capacity,
      academic_year: input.academicYear,
      color_hex: input.colorHex,
    },
  });
}

export async function softDeleteBatchById(teacherId: string, batchId: string) {
  const existing = await prisma.batch.findFirst({
    where: {
      id: batchId,
      teacher_id: teacherId,
      deleted_at: null,
    },
    select: {
      id: true,
    },
  });

  if (!existing) {
    throw new Error('Batch not found');
  }

  return prisma.batch.update({
    where: {
      id: existing.id,
    },
    data: {
      deleted_at: new Date(),
      is_active: false,
    },
  });
}

export async function enrollStudentInBatch(
  teacherId: string,
  batchId: string,
  input: EnrollStudentInput,
) {
  const [batch, student] = await Promise.all([
    prisma.batch.findFirst({
      where: {
        id: batchId,
        teacher_id: teacherId,
        deleted_at: null,
      },
      include: {
        _count: {
          select: {
            batch_students: {
              where: {
                deleted_at: null,
                is_active: true,
                student: {
                  deleted_at: null,
                },
              },
            },
          },
        },
      },
    }),
    prisma.student.findFirst({
      where: {
        id: input.studentId,
        teacher_id: teacherId,
        deleted_at: null,
      },
      select: {
        id: true,
      },
    }),
  ]);

  if (!batch) {
    throw new Error('Batch not found');
  }

  if (!student) {
    throw new Error('Student not found');
  }

  const activeStudentCount = batch._count.batch_students;
  if (activeStudentCount >= batch.capacity) {
    throw new Error('Batch is full');
  }

  await prisma.batchStudent.upsert({
    where: {
      batch_id_student_id: {
        batch_id: batchId,
        student_id: input.studentId,
      },
    },
    update: {
      deleted_at: null,
      is_active: true,
      left_at: null,
    },
    create: {
      batch_id: batchId,
      student_id: input.studentId,
      joined_at: toDateOnly(new Date()),
      is_active: true,
    },
  });

  return {
    batchId,
    studentId: input.studentId,
    message: 'Student enrolled successfully',
  };
}

export async function createHoliday(teacherId: string, input: CreateHolidayInput) {
  if (input.batchId) {
    const batch = await prisma.batch.findFirst({
      where: {
        id: input.batchId,
        teacher_id: teacherId,
        deleted_at: null,
      },
      select: { id: true },
    });

    if (!batch) {
      throw new Error('Batch not found');
    }
  }

  return prisma.holiday.create({
    data: {
      teacher_id: teacherId,
      batch_id: input.batchId,
      date: toDateOnly(input.date),
      title: input.title,
    },
  });
}

export async function listHolidays(teacherId: string, query: ListHolidaysQuery) {
  const where: Prisma.HolidayWhereInput = {
    teacher_id: teacherId,
    deleted_at: null,
  };

  if (query.batchId) {
    where.batch_id = query.batchId;
  }

  if (query.from || query.to) {
    where.date = {
      gte: query.from ? toDateOnly(query.from) : undefined,
      lte: query.to ? toDateOnly(query.to) : undefined,
    };
  }

  return prisma.holiday.findMany({
    where,
    orderBy: {
      date: 'asc',
    },
    include: {
      batch: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

export async function getBatchRoster(teacherId: string, batchId: string) {
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

  const enrollments = await prisma.batchStudent.findMany({
    where: {
      batch_id: batchId,
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
  });

  const studentIds = enrollments.map((row) => row.student.id);

  const attendanceRows = studentIds.length
    ? await prisma.attendance.findMany({
        where: {
          batch_id: batchId,
          student_id: {
            in: studentIds,
          },
          deleted_at: null,
        },
        select: {
          student_id: true,
          status: true,
        },
      })
    : [];

  const attendanceMap = new Map<
    string,
    {
      presentOrLate: number;
      totalMarked: number;
    }
  >();

  for (const row of attendanceRows) {
    const current = attendanceMap.get(row.student_id) ?? { presentOrLate: 0, totalMarked: 0 };

    if (row.status === 'present' || row.status === 'late' || row.status === 'absent') {
      current.totalMarked += 1;
    }

    if (row.status === 'present' || row.status === 'late') {
      current.presentOrLate += 1;
    }

    attendanceMap.set(row.student_id, current);
  }

  const students = enrollments.map((row) => {
    const summary = attendanceMap.get(row.student.id) ?? { presentOrLate: 0, totalMarked: 0 };
    const attendancePercent =
      summary.totalMarked > 0 ? Math.round((summary.presentOrLate / summary.totalMarked) * 100) : 0;

    return {
      studentId: row.student.id,
      studentCode: row.student.student_code,
      name: row.student.name,
      status: row.student.status,
      attendancePercent,
    };
  });

  return {
    batch,
    students,
  };
}
