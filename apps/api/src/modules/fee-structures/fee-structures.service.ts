import { prisma } from '../../config/prisma.js';
import type { CreateFeeStructureInput, UpdateFeeStructureInput } from './fee-structures.schema.js';

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

export async function createFeeStructure(teacherId: string, input: CreateFeeStructureInput) {
  return prisma.feeStructure.create({
    data: {
      teacher_id: teacherId,
      name: input.name,
      amount: BigInt(input.amount),
      frequency: input.frequency,
      subject: input.subject,
      description: input.description,
      is_active: input.isActive,
    },
  });
}

export async function updateFeeStructureById(
  teacherId: string,
  feeStructureId: string,
  input: UpdateFeeStructureInput,
) {
  const existing = await prisma.feeStructure.findFirst({
    where: {
      id: feeStructureId,
      teacher_id: teacherId,
      deleted_at: null,
    },
    select: {
      id: true,
    },
  });

  if (!existing) {
    throw new Error('Fee structure not found');
  }

  return prisma.feeStructure.update({
    where: {
      id: existing.id,
    },
    data: {
      name: input.name,
      amount: input.amount !== undefined ? BigInt(input.amount) : undefined,
      frequency: input.frequency,
      subject: input.subject,
      description: input.description,
      is_active: input.isActive,
    },
  });
}
