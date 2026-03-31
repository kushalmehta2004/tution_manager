import { Router } from 'express';
import { attendanceRouter } from '../modules/attendance/attendance.routes.js';
import { authRouter } from '../modules/auth/auth.routes.js';
import { batchesRouter } from '../modules/batches/batches.routes.js';
import { dashboardRouter } from '../modules/dashboard/dashboard.routes.js';
import { feeStructuresRouter } from '../modules/fee-structures/fee-structures.routes.js';
import { reminderWebhookHandler } from '../modules/fees/fees.controller.js';
import { feesRouter } from '../modules/fees/fees.routes.js';
import { studentsRouter } from '../modules/students/students.routes.js';
import { requireAuth } from '../middleware/auth.js';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

apiRouter.use('/auth', authRouter);
apiRouter.post('/fees/reminders/webhook', reminderWebhookHandler);
apiRouter.use('/students', requireAuth, studentsRouter);
apiRouter.use('/batches', requireAuth, batchesRouter);
apiRouter.use('/attendance', requireAuth, attendanceRouter);
apiRouter.use('/dashboard', requireAuth, dashboardRouter);
apiRouter.use('/fee-structures', requireAuth, feeStructuresRouter);
apiRouter.use('/fees', requireAuth, feesRouter);

apiRouter.get('/me', requireAuth, (req, res) => {
  res.status(200).json({ user: req.user });
});
