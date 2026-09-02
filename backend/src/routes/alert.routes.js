import { Router } from 'express';
import {
  getAlerts,
  getAlert,
  ackAlert,
  closeAlert,
  getRules,
  createRule
} from '../controllers/alert.controller.js';
import { authenticate } from '../middleware/authenticate.js';

export const alertRouter = Router();

alertRouter.use(authenticate);

alertRouter.get('/', getAlerts);
alertRouter.get('/rules', getRules);
alertRouter.post('/rules', createRule);
alertRouter.get('/:id', getAlert);
alertRouter.post('/:id/acknowledge', ackAlert);
alertRouter.post('/:id/resolve', closeAlert);
