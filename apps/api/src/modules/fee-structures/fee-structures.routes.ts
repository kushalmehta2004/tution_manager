import { Router } from 'express';
import {
	createFeeStructureHandler,
	listFeeStructuresHandler,
	updateFeeStructureHandler,
} from './fee-structures.controller.js';

export const feeStructuresRouter = Router();

feeStructuresRouter.get('/', listFeeStructuresHandler);
feeStructuresRouter.post('/', createFeeStructureHandler);
feeStructuresRouter.put('/:id', updateFeeStructureHandler);
