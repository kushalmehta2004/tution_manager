import type { Request, Response } from 'express';
import {
  createFeeStructureSchema,
  feeStructureIdParamSchema,
  updateFeeStructureSchema,
} from './fee-structures.schema.js';
import {
  createFeeStructure,
  listFeeStructures,
  updateFeeStructureById,
} from './fee-structures.service.js';

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

export async function listFeeStructuresHandler(req: Request, res: Response): Promise<void> {
  const teacherId = requireTeacherId(req, res);
  if (!teacherId) {
    return;
  }

  const rows = await listFeeStructures(teacherId);
  res.status(200).json({
    data: rows.map((row) => ({
      ...row,
      amount: Number(row.amount),
    })),
  });
}

export async function createFeeStructureHandler(req: Request, res: Response): Promise<void> {
  const teacherId = requireTeacherId(req, res);
  if (!teacherId) {
    return;
  }

  const parsed = createFeeStructureSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid request body', errors: parsed.error.flatten() });
    return;
  }

  try {
    const created = await createFeeStructure(teacherId, parsed.data);
    res.status(201).json({
      ...created,
      amount: Number(created.amount),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create fee structure';
    res.status(400).json({ message });
  }
}

export async function updateFeeStructureHandler(req: Request, res: Response): Promise<void> {
  const teacherId = requireTeacherId(req, res);
  if (!teacherId) {
    return;
  }

  const parsedParams = feeStructureIdParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    res.status(400).json({ message: 'Invalid fee structure id', errors: parsedParams.error.flatten() });
    return;
  }

  const parsedBody = updateFeeStructureSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({ message: 'Invalid request body', errors: parsedBody.error.flatten() });
    return;
  }

  try {
    const updated = await updateFeeStructureById(teacherId, parsedParams.data.id, parsedBody.data);
    res.status(200).json({
      ...updated,
      amount: Number(updated.amount),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update fee structure';
    const status = message === 'Fee structure not found' ? 404 : 400;
    res.status(status).json({ message });
  }
}
