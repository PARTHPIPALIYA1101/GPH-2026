import { z } from 'zod';
import {
  listWatchlists,
  findWatchlistById,
  createWatchlist,
  addWatchlistItem,
  removeWatchlistItem
} from '../repositories/watchlist.repository.js';
import { writeAudit } from '../repositories/audit.repository.js';
import { failure, success } from '../utils/api-response.js';

const createWatchlistSchema = z.object({
  name: z.string().min(3),
  entityType: z.enum(['PLATE', 'VEHICLE', 'PERSON', 'OBJECT', 'CAMERA']),
  scope: z.enum(['DEPARTMENT', 'GLOBAL']).default('DEPARTMENT'),
  departmentId: z.string().uuid().optional(),
  description: z.string().optional()
});

const addItemSchema = z.object({
  value: z.string().min(2),
  description: z.string().optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM')
});

export async function getWatchlists(req, res) {
  const watchlists = await listWatchlists(req.user);
  return success(res, watchlists);
}

export async function getWatchlist(req, res) {
  const watchlist = await findWatchlistById(req.user, req.params.id);
  if (!watchlist) {
    return failure(res, 'WATCHLIST_NOT_FOUND', 'Watchlist not found or unauthorized.', 404);
  }
  return success(res, watchlist);
}

export async function createNewWatchlist(req, res) {
  const isStateAdmin = req.user.roles.includes('STATE_ADMIN');
  const isDeptHead = req.user.roles.includes('DEPARTMENT_HEAD');
  const isInvestigator = req.user.roles.includes('INVESTIGATOR');

  if (!isStateAdmin && !isDeptHead && !isInvestigator) {
    return failure(res, 'AUTHORIZATION_DENIED', 'You do not have permission to create watchlists.', 403);
  }

  const parsed = createWatchlistSchema.safeParse(req.body);
  if (!parsed.success) {
    return failure(res, 'VALIDATION_ERROR', 'Invalid watchlist payload.', 400);
  }

  const payload = parsed.data;
  if (!isStateAdmin && payload.scope === 'GLOBAL') {
    return failure(res, 'AUTHORIZATION_DENIED', 'Only State Admin can create Global watchlists.', 403);
  }

  if (!isStateAdmin) {
    payload.departmentId = req.user.departmentId;
  }

  const created = await createWatchlist({
    name: payload.name,
    entityType: payload.entityType,
    scope: payload.scope,
    departmentId: payload.departmentId,
    description: payload.description,
    userId: req.user.id
  });

  await writeAudit({
    actorUserId: req.user.id,
    action: 'WATCHLIST_CREATE',
    entityType: 'WATCHLIST',
    entityId: created.id,
    requestId: req.id,
    detail: { name: payload.name, scope: payload.scope, entityType: payload.entityType }
  });

  return success(res, created, 'Watchlist created successfully.', 201);
}

export async function addItem(req, res) {
  const watchlist = await findWatchlistById(req.user, req.params.id);
  if (!watchlist) {
    return failure(res, 'WATCHLIST_NOT_FOUND', 'Watchlist not found or unauthorized.', 404);
  }

  const parsed = addItemSchema.safeParse(req.body);
  if (!parsed.success) {
    return failure(res, 'VALIDATION_ERROR', 'Invalid item parameters.', 400);
  }

  const item = await addWatchlistItem({
    watchlistId: req.params.id,
    value: parsed.data.value,
    description: parsed.data.description,
    severity: parsed.data.severity
  });

  await writeAudit({
    actorUserId: req.user.id,
    action: 'WATCHLIST_ITEM_ADD',
    entityType: 'WATCHLIST_ITEM',
    entityId: item.id,
    requestId: req.id,
    detail: { watchlistId: req.params.id, value: item.value, severity: item.severity }
  });

  return success(res, item, 'Item added to watchlist.', 201);
}

export async function deleteItem(req, res) {
  await removeWatchlistItem(req.params.itemId);
  await writeAudit({
    actorUserId: req.user.id,
    action: 'WATCHLIST_ITEM_REMOVE',
    entityType: 'WATCHLIST_ITEM',
    entityId: req.params.itemId,
    requestId: req.id
  });
  return success(res, { removed: true }, 'Watchlist item deactivated.');
}
