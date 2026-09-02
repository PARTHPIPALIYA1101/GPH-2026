import { Router } from 'express';
import { search } from '../controllers/search.controller.js';
import { authenticate } from '../middleware/authenticate.js';

export const searchRouter = Router();

searchRouter.use(authenticate);

searchRouter.get('/', search);
