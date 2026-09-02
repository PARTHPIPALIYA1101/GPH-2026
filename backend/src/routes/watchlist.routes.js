import { Router } from 'express';
import {
  getWatchlists,
  getWatchlist,
  createNewWatchlist,
  addItem,
  deleteItem
} from '../controllers/watchlist.controller.js';
import { authenticate } from '../middleware/authenticate.js';

export const watchlistRouter = Router();

watchlistRouter.use(authenticate);

watchlistRouter.get('/', getWatchlists);
watchlistRouter.get('/:id', getWatchlist);
watchlistRouter.post('/', createNewWatchlist);
watchlistRouter.post('/:id/items', addItem);
watchlistRouter.delete('/:id/items/:itemId', deleteItem);
