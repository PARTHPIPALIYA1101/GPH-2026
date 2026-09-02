import { Router } from 'express';
import {
  getInvestigations,
  getInvestigation,
  createNewInvestigation,
  submitDecision,
  attachDetection
} from '../controllers/investigation.controller.js';
import { authenticate } from '../middleware/authenticate.js';

export const investigationRouter = Router();

investigationRouter.use(authenticate);

investigationRouter.get('/', getInvestigations);
investigationRouter.get('/:id', getInvestigation);
investigationRouter.post('/', createNewInvestigation);
investigationRouter.post('/:id/decision', submitDecision);
investigationRouter.post('/:id/attach-detection', attachDetection);
