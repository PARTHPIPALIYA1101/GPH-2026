import { Router } from 'express';
import { openStream, closeStream, getStats } from '../controllers/stream.controller.js';
import { authenticate } from '../middleware/authenticate.js';

export const streamRouter = Router();

streamRouter.use(authenticate);

streamRouter.post('/session', openStream);
streamRouter.post('/session/release', closeStream);
streamRouter.get('/stats', getStats);
