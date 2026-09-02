import { Router } from 'express';
import { login, logout, me } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/authenticate.js';

export const authRouter = Router();

authRouter.post('/login', login);
authRouter.get('/me', authenticate, me);
authRouter.post('/logout', authenticate, logout);
