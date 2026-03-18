import { Router } from 'express';
import {
  batchRosterHandler,
  createHolidayHandler,
  createBatchHandler,
  deleteBatchHandler,
  enrollStudentInBatchHandler,
  listHolidaysHandler,
  listBatchesHandler,
  updateBatchHandler,
} from './batches.controller.js';

export const batchesRouter = Router();

batchesRouter.get('/', listBatchesHandler);
batchesRouter.post('/', createBatchHandler);
batchesRouter.put('/:id', updateBatchHandler);
batchesRouter.delete('/:id', deleteBatchHandler);
batchesRouter.post('/:id/students', enrollStudentInBatchHandler);
batchesRouter.get('/:id/roster', batchRosterHandler);
batchesRouter.get('/holidays', listHolidaysHandler);
batchesRouter.post('/holidays', createHolidayHandler);
