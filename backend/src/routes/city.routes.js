import { Router } from 'express';
import { getCities, getCityById, createNewCity } from '../controllers/city.controller.js';
import { authenticate } from '../middleware/authenticate.js';

export const cityRouter = Router();

cityRouter.use(authenticate);

cityRouter.get('/', getCities);
cityRouter.get('/:id', getCityById);
cityRouter.post('/', createNewCity);
