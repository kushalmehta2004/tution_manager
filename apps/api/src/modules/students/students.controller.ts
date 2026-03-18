import type { Request, Response } from 'express';
import {
  createStudentSchema,
  enrollStudentSchema,
  listStudentsQuerySchema,
  parentInviteSchema,
  studentAttendanceHeatmapQuerySchema,
  studentDocumentUploadSchema,
  studentIdParamSchema,
  updateStudentSchema,
} from './students.schema.js';
import {
  createParentInvite,
  createStudent,
  enrollStudentWithFeeSchedule,
  getStudentAttendanceHeatmap,
  getStudentById,
  listStudents,
  softDeleteStudentById,
  uploadStudentDocument,
  uploadStudentPhoto,
  updateStudentById,
} from './students.service.js';

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

export async function listStudentsHandler(req: Request, res: Response): Promise<void> {
  const teacherId = requireTeacherId(req, res);
  if (!teacherId) {
    return;
  }

  const parsed = listStudentsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid query params', errors: parsed.error.flatten() });
    return;
  }

  const result = await listStudents(teacherId, parsed.data);
  res.status(200).json(result);
}

export async function createStudentHandler(req: Request, res: Response): Promise<void> {
  const teacherId = requireTeacherId(req, res);
  if (!teacherId) {
    return;
  }

  const parsed = createStudentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid request body', errors: parsed.error.flatten() });
    return;
  }

  try {
    const student = await createStudent(teacherId, parsed.data);
    res.status(201).json(student);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create student';
    res.status(400).json({ message });
  }
}

export async function enrollStudentHandler(req: Request, res: Response): Promise<void> {
  const teacherId = requireTeacherId(req, res);
  if (!teacherId) {
    return;
  }

  const parsed = enrollStudentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid request body', errors: parsed.error.flatten() });
    return;
  }

  try {
    const result = await enrollStudentWithFeeSchedule(teacherId, parsed.data);
    res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Enrollment failed';
    const status = message === 'Fee structure not found' ? 404 : 400;
    res.status(status).json({ message });
  }
}

export async function getStudentByIdHandler(req: Request, res: Response): Promise<void> {
  const teacherId = requireTeacherId(req, res);
  if (!teacherId) {
    return;
  }

  const parsed = studentIdParamSchema.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid student id', errors: parsed.error.flatten() });
    return;
  }

  try {
    const student = await getStudentById(teacherId, parsed.data.id);
    res.status(200).json(student);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch student';
    const status = message === 'Student not found' ? 404 : 400;
    res.status(status).json({ message });
  }
}

export async function updateStudentHandler(req: Request, res: Response): Promise<void> {
  const teacherId = requireTeacherId(req, res);
  if (!teacherId) {
    return;
  }

  const parsedParams = studentIdParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    res.status(400).json({ message: 'Invalid student id', errors: parsedParams.error.flatten() });
    return;
  }

  const parsedBody = updateStudentSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({ message: 'Invalid request body', errors: parsedBody.error.flatten() });
    return;
  }

  try {
    const student = await updateStudentById(teacherId, parsedParams.data.id, parsedBody.data);
    res.status(200).json(student);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update student';
    const status = message === 'Student not found' ? 404 : 400;
    res.status(status).json({ message });
  }
}

export async function deleteStudentHandler(req: Request, res: Response): Promise<void> {
  const teacherId = requireTeacherId(req, res);
  if (!teacherId) {
    return;
  }

  const parsed = studentIdParamSchema.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid student id', errors: parsed.error.flatten() });
    return;
  }

  try {
    await softDeleteStudentById(teacherId, parsed.data.id);
    res.status(204).send();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete student';
    const status = message === 'Student not found' ? 404 : 400;
    res.status(status).json({ message });
  }
}

export async function uploadStudentPhotoHandler(req: Request, res: Response): Promise<void> {
  const teacherId = requireTeacherId(req, res);
  if (!teacherId) {
    return;
  }

  const parsed = studentIdParamSchema.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid student id', errors: parsed.error.flatten() });
    return;
  }

  if (!req.file) {
    res.status(400).json({ message: 'Photo file is required' });
    return;
  }

  try {
    const result = await uploadStudentPhoto(teacherId, parsed.data.id, {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      buffer: req.file.buffer,
    });

    res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to upload photo';
    const status = message === 'Student not found' ? 404 : 400;
    res.status(status).json({ message });
  }
}

export async function uploadStudentDocumentHandler(req: Request, res: Response): Promise<void> {
  const teacherId = requireTeacherId(req, res);
  if (!teacherId) {
    return;
  }

  const parsedParams = studentIdParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    res.status(400).json({ message: 'Invalid student id', errors: parsedParams.error.flatten() });
    return;
  }

  const parsedBody = studentDocumentUploadSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({ message: 'Invalid request body', errors: parsedBody.error.flatten() });
    return;
  }

  if (!req.file) {
    res.status(400).json({ message: 'Document file is required' });
    return;
  }

  try {
    const result = await uploadStudentDocument(
      teacherId,
      parsedParams.data.id,
      parsedBody.data,
      {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        buffer: req.file.buffer,
      },
    );

    res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to upload document';
    const status = message === 'Student not found' ? 404 : 400;
    res.status(status).json({ message });
  }
}

export async function parentInviteHandler(req: Request, res: Response): Promise<void> {
  const teacherId = requireTeacherId(req, res);
  if (!teacherId) {
    return;
  }

  const parsedParams = studentIdParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    res.status(400).json({ message: 'Invalid student id', errors: parsedParams.error.flatten() });
    return;
  }

  const parsedBody = parentInviteSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({ message: 'Invalid request body', errors: parsedBody.error.flatten() });
    return;
  }

  try {
    const result = await createParentInvite(teacherId, parsedParams.data.id, parsedBody.data);
    res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create parent invite';
    let status = 400;

    if (message === 'Student not found') {
      status = 404;
    }

    if (message === 'Phone already linked to another student') {
      status = 409;
    }

    res.status(status).json({ message });
  }
}

export async function getStudentAttendanceHeatmapHandler(req: Request, res: Response): Promise<void> {
  const teacherId = requireTeacherId(req, res);
  if (!teacherId) {
    return;
  }

  const parsedParams = studentIdParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    res.status(400).json({ message: 'Invalid student id', errors: parsedParams.error.flatten() });
    return;
  }

  const parsedQuery = studentAttendanceHeatmapQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    res.status(400).json({ message: 'Invalid query params', errors: parsedQuery.error.flatten() });
    return;
  }

  try {
    const result = await getStudentAttendanceHeatmap(teacherId, parsedParams.data.id, parsedQuery.data);
    res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch attendance heatmap';
    const status = message === 'Student not found' ? 404 : 400;
    res.status(status).json({ message });
  }
}
