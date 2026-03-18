import { Router } from 'express';
import {
  createStudentHandler,
  deleteStudentHandler,
  enrollStudentHandler,
  getStudentAttendanceHeatmapHandler,
  getStudentByIdHandler,
  listStudentsHandler,
  parentInviteHandler,
  uploadStudentDocumentHandler,
  uploadStudentPhotoHandler,
  updateStudentHandler,
} from './students.controller.js';
import { studentDocumentUpload, studentPhotoUpload } from '../../middleware/upload.js';

export const studentsRouter = Router();

studentsRouter.get('/', listStudentsHandler);
studentsRouter.post('/', createStudentHandler);
studentsRouter.post('/enroll', enrollStudentHandler);
studentsRouter.get('/:id', getStudentByIdHandler);
studentsRouter.get('/:id/attendance-heatmap', getStudentAttendanceHeatmapHandler);
studentsRouter.put('/:id', updateStudentHandler);
studentsRouter.delete('/:id', deleteStudentHandler);
studentsRouter.post('/:id/photo', studentPhotoUpload.single('photo'), uploadStudentPhotoHandler);
studentsRouter.post(
  '/:id/documents',
  studentDocumentUpload.single('document'),
  uploadStudentDocumentHandler,
);
studentsRouter.post('/:id/parent-invite', parentInviteHandler);
