import { Router } from 'express';
import {
  annualSummaryExportHandler,
  annualSummaryHandler,
  createFeePaymentHandler,
  dailyCollectionSummaryHandler,
  listStudentFeesHandler,
  monthlyCollectionReportHandler,
  outstandingReportHandler,
  sendFeeReminderHandler,
  studentLedgerHandler,
} from './fees.controller.js';

export const feesRouter = Router();

feesRouter.get('/student-fees', listStudentFeesHandler);
feesRouter.post('/payments', createFeePaymentHandler);
feesRouter.get('/summary/daily', dailyCollectionSummaryHandler);
feesRouter.post('/reminders/send', sendFeeReminderHandler);
feesRouter.get('/reports/monthly', monthlyCollectionReportHandler);
feesRouter.get('/reports/student-ledger', studentLedgerHandler);
feesRouter.get('/reports/outstanding', outstandingReportHandler);
feesRouter.get('/reports/annual', annualSummaryHandler);
feesRouter.get('/reports/annual/export/:format', annualSummaryExportHandler);