import type { Request, Response } from 'express';
import { loginSchema, refreshSchema, registerTeacherSchema } from './auth.schema.js';
import { loginTeacher, refreshAccessToken, registerTeacher } from './auth.service.js';

export async function registerTeacherHandler(req: Request, res: Response): Promise<void> {
  const parsed = registerTeacherSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid request body', errors: parsed.error.flatten() });
    return;
  }

  try {
    const result = await registerTeacher(parsed.data);
    res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed';
    res.status(409).json({ message });
  }
}

export async function loginHandler(req: Request, res: Response): Promise<void> {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid request body', errors: parsed.error.flatten() });
    return;
  }

  try {
    const result = await loginTeacher(parsed.data);
    res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed';
    res.status(401).json({ message });
  }
}

export function refreshHandler(req: Request, res: Response): void {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid request body', errors: parsed.error.flatten() });
    return;
  }

  try {
    const result = refreshAccessToken(parsed.data.refreshToken);
    res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Refresh failed';
    res.status(401).json({ message });
  }
}

export function logoutHandler(_req: Request, res: Response): void {
  res.status(200).json({ message: 'Logged out successfully' });
}
