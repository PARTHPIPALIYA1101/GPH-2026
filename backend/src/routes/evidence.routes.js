import { Router } from 'express';
import { getEvidenceList, saveEvidence } from '../controllers/evidence.controller.js';
import { authenticate } from '../middleware/authenticate.js';

export const evidenceRouter = Router();

evidenceRouter.use(authenticate);

evidenceRouter.get('/', getEvidenceList);
evidenceRouter.post('/', saveEvidence);
