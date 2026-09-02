import { Router } from 'express';
import { getReports, generateReport, downloadReport } from '../controllers/report.controller.js';
import { authenticate } from '../middleware/authenticate.js';

export const reportRouter = Router();

reportRouter.use(authenticate);

reportRouter.get('/', getReports);
reportRouter.post('/', generateReport);
reportRouter.get('/:id/download', downloadReport);
