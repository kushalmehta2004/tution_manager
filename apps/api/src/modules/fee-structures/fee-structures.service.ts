import { prisma } from '../../config/prisma.js';

export async function listFeeStructures(teacherId: string) {
  return prisma.feeStructure.findMany({
    where: {
      teacher_id: teacherId,
      deleted_at: null,
      is_active: true,
    },
    orderBy: {
      created_at: 'desc',
    },
    select: {
      id: true,
      name: true,
      amount: true,
      frequency: true,
      subject: true,
    },
  });
}
