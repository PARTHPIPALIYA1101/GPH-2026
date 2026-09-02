import { Router } from 'express';
import { live, overview, ready } from '../controllers/health.controller.js';

export const healthRouter = Router();
healthRouter.get('/', overview);
healthRouter.get('/live', live);
healthRouter.get('/ready', ready);
