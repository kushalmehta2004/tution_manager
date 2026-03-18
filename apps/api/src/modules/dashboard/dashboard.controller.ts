import type { Request, Response } from 'express';
import { getDashboardSummary } from './dashboard.service.js';

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

export async function getDashboardSummaryHandler(req: Request, res: Response): Promise<void> {
  const teacherId = requireTeacherId(req, res);
  if (!teacherId) {
    return;
  }

  const result = await getDashboardSummary(teacherId);
  res.status(200).json(result);
}
