import { Router } from 'express';
import { getDashboardSummaryHandler } from './dashboard.controller.js';

export const dashboardRouter = Router();

dashboardRouter.get('/summary', getDashboardSummaryHandler);
