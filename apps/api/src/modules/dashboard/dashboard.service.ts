import { AttendanceStatus, StudentFeeStatus } from '@prisma/client';
import { prisma } from '../../config/prisma.js';

function toDateOnly(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function startOfMonth(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

function monthKey(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function extractTimeMinutes(value: Date): number {
  return value.getUTCHours() * 60 + value.getUTCMinutes();
}

function classDateTimeMs(classDate: Date, startTime: Date): number {
  return Date.UTC(
    classDate.getUTCFullYear(),
    classDate.getUTCMonth(),
    classDate.getUTCDate(),
    startTime.getUTCHours(),
    startTime.getUTCMinutes(),
    0,
    0,
  );
}

function attendancePercentFromStatuses(statuses: AttendanceStatus[]): number {
  let totalMarked = 0;
  let presentOrLate = 0;

  for (const status of statuses) {
    if (status === 'present' || status === 'late' || status === 'absent') {
      totalMarked += 1;
    }

    if (status === 'present' || status === 'late') {
      presentOrLate += 1;
    }
  }

  if (totalMarked === 0) {
    return 0;
  }

  return Math.round((presentOrLate / totalMarked) * 100);
}

export async function getDashboardSummary(teacherId: string) {
  const today = toDateOnly(new Date());
  const sixMonthsAgo = startOfMonth(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 5, 1)));
  const nextTwoWeeks = addDays(today, 14);

  const [studentsEnrolled, activeBatches, trialStudents, pendingFeesAggregate, todayAttendanceRows] =
    await Promise.all([
      prisma.student.count({
        where: {
          teacher_id: teacherId,
          deleted_at: null,
        },
      }),
      prisma.batch.count({
        where: {
          teacher_id: teacherId,
          deleted_at: null,
          is_active: true,
        },
      }),
      prisma.student.count({
        where: {
          teacher_id: teacherId,
          deleted_at: null,
          status: 'trial',
        },
      }),
      prisma.studentFee.aggregate({
        where: {
          teacher_id: teacherId,
          deleted_at: null,
          status: {
            in: [StudentFeeStatus.pending, StudentFeeStatus.partial, StudentFeeStatus.overdue],
          },
        },
        _sum: {
          amount_due: true,
        },
      }),
      prisma.attendance.groupBy({
        by: ['status'],
        where: {
          deleted_at: null,
          date: today,
          batch: {
            teacher_id: teacherId,
            deleted_at: null,
          },
        },
        _count: {
          _all: true,
        },
      }),
    ]);

  const todayAttendance = {
    present: 0,
    absent: 0,
    late: 0,
    totalMarked: 0,
  };

  for (const row of todayAttendanceRows) {
    if (row.status === 'present' || row.status === 'absent' || row.status === 'late') {
      todayAttendance[row.status] = row._count._all;
      todayAttendance.totalMarked += row._count._all;
    }
  }

  const overdueFeesRaw = await prisma.studentFee.findMany({
    where: {
      teacher_id: teacherId,
      deleted_at: null,
      status: StudentFeeStatus.overdue,
    },
    orderBy: [{ amount_due: 'desc' }, { due_date: 'asc' }],
    take: 8,
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

  const overdueFees = overdueFeesRaw.map((row) => ({
    studentFeeId: row.id,
    studentId: row.student.id,
    studentName: row.student.name,
    studentCode: row.student.student_code,
    amountDue: Number(row.amount_due),
    dueDate: row.due_date,
  }));

  const [batches, holidays] = await Promise.all([
    prisma.batch.findMany({
      where: {
        teacher_id: teacherId,
        deleted_at: null,
        is_active: true,
      },
      select: {
        id: true,
        name: true,
        subject: true,
        days_of_week: true,
        start_time: true,
        end_time: true,
        room: true,
      },
    }),
    prisma.holiday.findMany({
      where: {
        teacher_id: teacherId,
        deleted_at: null,
        date: {
          gte: today,
          lte: nextTwoWeeks,
        },
      },
      select: {
        batch_id: true,
        date: true,
      },
    }),
  ]);

  const holidayMap = new Map<string, Set<string>>();
  const globalHolidaySet = new Set<string>();
  for (const holiday of holidays) {
    const key = monthKey(holiday.date) + `-${String(holiday.date.getUTCDate()).padStart(2, '0')}`;

    if (!holiday.batch_id) {
      globalHolidaySet.add(key);
      continue;
    }

    const set = holidayMap.get(holiday.batch_id) ?? new Set<string>();
    set.add(key);
    holidayMap.set(holiday.batch_id, set);
  }

  const upcomingClassesCandidates = batches
    .map((batch) => {
      for (let dayOffset = 0; dayOffset <= 14; dayOffset += 1) {
        const candidateDate = addDays(today, dayOffset);
        const dayOfWeek = candidateDate.getUTCDay();
        if (!batch.days_of_week.includes(dayOfWeek)) {
          continue;
        }

        const dayKey = monthKey(candidateDate) + `-${String(candidateDate.getUTCDate()).padStart(2, '0')}`;
        const batchHolidaySet = holidayMap.get(batch.id);
        const blocked = globalHolidaySet.has(dayKey) || (batchHolidaySet ? batchHolidaySet.has(dayKey) : false);
        if (blocked) {
          continue;
        }

        return {
          batchId: batch.id,
          batchName: batch.name,
          subject: batch.subject,
          classDate: candidateDate,
          startTime: batch.start_time,
          endTime: batch.end_time,
          room: batch.room,
          sortAt: classDateTimeMs(candidateDate, batch.start_time),
        };
      }

      return null;
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => a.sortAt - b.sortAt)
    .slice(0, 3)
    .map((row) => ({
      batchId: row.batchId,
      batchName: row.batchName,
      subject: row.subject,
      classDate: row.classDate,
      startTime: row.startTime,
      endTime: row.endTime,
      room: row.room,
    }));

  const monthlyPaymentRows = await prisma.feePayment.findMany({
    where: {
      teacher_id: teacherId,
      deleted_at: null,
      payment_date: {
        gte: sixMonthsAgo,
      },
    },
    select: {
      payment_date: true,
      amount_paid: true,
    },
  });

  const monthTotals = new Map<string, number>();
  for (let index = 0; index < 6; index += 1) {
    const base = new Date(Date.UTC(sixMonthsAgo.getUTCFullYear(), sixMonthsAgo.getUTCMonth() + index, 1));
    monthTotals.set(monthKey(base), 0);
  }

  for (const row of monthlyPaymentRows) {
    const key = monthKey(row.payment_date);
    if (!monthTotals.has(key)) {
      continue;
    }

    monthTotals.set(key, (monthTotals.get(key) ?? 0) + Number(row.amount_paid));
  }

  const monthlyRevenue = Array.from(monthTotals.entries()).map(([key, totalCollected]) => ({
    month: key,
    totalCollected,
  }));

  const attendanceRows = await prisma.attendance.findMany({
    where: {
      deleted_at: null,
      student: {
        teacher_id: teacherId,
        deleted_at: null,
      },
    },
    select: {
      student_id: true,
      status: true,
    },
  });

  const attendanceByStudent = new Map<string, AttendanceStatus[]>();
  for (const row of attendanceRows) {
    const statuses = attendanceByStudent.get(row.student_id) ?? [];
    statuses.push(row.status);
    attendanceByStudent.set(row.student_id, statuses);
  }

  const lowAttendanceStudentIds = Array.from(attendanceByStudent.entries())
    .map(([studentId, statuses]) => ({
      studentId,
      attendancePercent: attendancePercentFromStatuses(statuses),
    }))
    .filter((row) => row.attendancePercent < 75)
    .sort((a, b) => a.attendancePercent - b.attendancePercent)
    .slice(0, 10);

  const lowAttendanceStudentIdSet = new Set(lowAttendanceStudentIds.map((row) => row.studentId));
  const lowAttendanceStudents = lowAttendanceStudentIdSet.size
    ? await prisma.student.findMany({
        where: {
          id: {
            in: Array.from(lowAttendanceStudentIdSet),
          },
          teacher_id: teacherId,
          deleted_at: null,
        },
        select: {
          id: true,
          name: true,
          student_code: true,
        },
      })
    : [];

  const lowAttendanceLookup = new Map(lowAttendanceStudents.map((row) => [row.id, row]));
  const lowAttendanceAlerts = lowAttendanceStudentIds
    .map((row) => {
      const student = lowAttendanceLookup.get(row.studentId);
      if (!student) {
        return null;
      }

      return {
        studentId: student.id,
        studentName: student.name,
        studentCode: student.student_code,
        attendancePercent: row.attendancePercent,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  return {
    kpis: {
      studentsEnrolled,
      activeBatches,
      trialStudents,
      pendingFees: Number(pendingFeesAggregate._sum.amount_due ?? 0n),
      todayAttendance,
      lowAttendanceCount: lowAttendanceAlerts.length,
    },
    overdueFees,
    upcomingClasses: upcomingClassesCandidates,
    monthlyRevenue,
    lowAttendanceAlerts,
  };
}
