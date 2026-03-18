import type { Request, Response } from 'express';
import {
  batchIdParamSchema,
  createHolidaySchema,
  createBatchSchema,
  enrollStudentSchema,
  listHolidaysQuerySchema,
  listBatchesQuerySchema,
  updateBatchSchema,
} from './batches.schema.js';
import {
  createHoliday,
  createBatch,
  enrollStudentInBatch,
  getBatchRoster,
  listHolidays,
  listBatches,
  softDeleteBatchById,
  updateBatchById,
} from './batches.service.js';

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

export async function listBatchesHandler(req: Request, res: Response): Promise<void> {
  const teacherId = requireTeacherId(req, res);
  if (!teacherId) {
    return;
  }

  const parsed = listBatchesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid query params', errors: parsed.error.flatten() });
    return;
  }

  const result = await listBatches(teacherId, parsed.data);
  res.status(200).json(result);
}

export async function createBatchHandler(req: Request, res: Response): Promise<void> {
  const teacherId = requireTeacherId(req, res);
  if (!teacherId) {
    return;
  }

  const parsed = createBatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid request body', errors: parsed.error.flatten() });
    return;
  }

  try {
    const batch = await createBatch(teacherId, parsed.data);
    res.status(201).json(batch);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create batch';
    res.status(400).json({ message });
  }
}

export async function updateBatchHandler(req: Request, res: Response): Promise<void> {
  const teacherId = requireTeacherId(req, res);
  if (!teacherId) {
    return;
  }

  const parsedParams = batchIdParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    res.status(400).json({ message: 'Invalid batch id', errors: parsedParams.error.flatten() });
    return;
  }

  const parsedBody = updateBatchSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({ message: 'Invalid request body', errors: parsedBody.error.flatten() });
    return;
  }

  try {
    const batch = await updateBatchById(teacherId, parsedParams.data.id, parsedBody.data);
    res.status(200).json(batch);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update batch';
    const status = message === 'Batch not found' ? 404 : 400;
    res.status(status).json({ message });
  }
}

export async function deleteBatchHandler(req: Request, res: Response): Promise<void> {
  const teacherId = requireTeacherId(req, res);
  if (!teacherId) {
    return;
  }

  const parsed = batchIdParamSchema.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid batch id', errors: parsed.error.flatten() });
    return;
  }

  try {
    await softDeleteBatchById(teacherId, parsed.data.id);
    res.status(204).send();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete batch';
    const status = message === 'Batch not found' ? 404 : 400;
    res.status(status).json({ message });
  }
}

export async function enrollStudentInBatchHandler(req: Request, res: Response): Promise<void> {
  const teacherId = requireTeacherId(req, res);
  if (!teacherId) {
    return;
  }

  const parsedParams = batchIdParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    res.status(400).json({ message: 'Invalid batch id', errors: parsedParams.error.flatten() });
    return;
  }

  const parsedBody = enrollStudentSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({ message: 'Invalid request body', errors: parsedBody.error.flatten() });
    return;
  }

  try {
    const result = await enrollStudentInBatch(teacherId, parsedParams.data.id, parsedBody.data);
    res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Enrollment failed';
    const status = message === 'Batch not found' || message === 'Student not found' ? 404 : 400;
    res.status(status).json({ message });
  }
}

export async function createHolidayHandler(req: Request, res: Response): Promise<void> {
  const teacherId = requireTeacherId(req, res);
  if (!teacherId) {
    return;
  }

  const parsed = createHolidaySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid request body', errors: parsed.error.flatten() });
    return;
  }

  try {
    const holiday = await createHoliday(teacherId, parsed.data);
    res.status(201).json(holiday);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create holiday';
    const status = message === 'Batch not found' ? 404 : 400;
    res.status(status).json({ message });
  }
}

export async function listHolidaysHandler(req: Request, res: Response): Promise<void> {
  const teacherId = requireTeacherId(req, res);
  if (!teacherId) {
    return;
  }

  const parsed = listHolidaysQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid query params', errors: parsed.error.flatten() });
    return;
  }

  const holidays = await listHolidays(teacherId, parsed.data);
  res.status(200).json({ data: holidays });
}

export async function batchRosterHandler(req: Request, res: Response): Promise<void> {
  const teacherId = requireTeacherId(req, res);
  if (!teacherId) {
    return;
  }

  const parsed = batchIdParamSchema.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid batch id', errors: parsed.error.flatten() });
    return;
  }

  try {
    const roster = await getBatchRoster(teacherId, parsed.data.id);
    res.status(200).json(roster);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch batch roster';
    const status = message === 'Batch not found' ? 404 : 400;
    res.status(status).json({ message });
  }
}
