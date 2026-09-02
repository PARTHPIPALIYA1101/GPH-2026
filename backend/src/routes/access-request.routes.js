import { Router } from 'express';
import { getRequests, getRequestById, requestAccess, decide, revoke } from '../controllers/access-request.controller.js';
import { authenticate } from '../middleware/authenticate.js';

export const accessRequestRouter = Router();

accessRequestRouter.use(authenticate);

accessRequestRouter.get('/', getRequests);
accessRequestRouter.get('/:id', getRequestById);
accessRequestRouter.post('/', requestAccess);
accessRequestRouter.post('/:id/decision', decide);
accessRequestRouter.post('/:id/revoke', revoke);
