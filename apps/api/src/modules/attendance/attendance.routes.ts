import { Router } from 'express';
import {
	exportAttendanceReportHandler,
	getAttendanceHandler,
	getAttendanceReportHandler,
	upsertAttendanceHandler,
} from './attendance.controller.js';

export const attendanceRouter = Router();

attendanceRouter.get('/', getAttendanceHandler);
attendanceRouter.post('/', upsertAttendanceHandler);
attendanceRouter.get('/reports', getAttendanceReportHandler);
attendanceRouter.get('/reports/export/:format', exportAttendanceReportHandler);
