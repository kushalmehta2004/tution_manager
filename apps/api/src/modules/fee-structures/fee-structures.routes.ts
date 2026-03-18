import { Router } from 'express';
import { listFeeStructuresHandler } from './fee-structures.controller.js';

export const feeStructuresRouter = Router();

feeStructuresRouter.get('/', listFeeStructuresHandler);
