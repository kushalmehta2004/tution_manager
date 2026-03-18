import { Router } from 'express';
import {
  loginHandler,
  logoutHandler,
  refreshHandler,
  registerTeacherHandler,
} from './auth.controller.js';

export const authRouter = Router();

authRouter.post('/register', registerTeacherHandler);
authRouter.post('/login', loginHandler);
authRouter.post('/refresh', refreshHandler);
authRouter.post('/logout', logoutHandler);
