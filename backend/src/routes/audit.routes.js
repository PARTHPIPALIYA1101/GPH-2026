import { Router } from 'express';
import { getAuditLogs } from '../controllers/audit.controller.js';
import { authenticate } from '../middleware/authenticate.js';

export const auditRouter = Router();

auditRouter.use(authenticate);

auditRouter.get('/', getAuditLogs);
