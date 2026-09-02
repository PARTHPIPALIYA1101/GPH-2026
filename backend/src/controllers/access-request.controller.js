import { z } from 'zod';
import { canAccessCity, canManageDepartment, isStateAdmin } from '../auth/authorization.js';
import {
  createAccessRequest,
  decideRequest,
  findRequest,
  revokeRequest,
  listAccessRequests
} from '../repositories/access-request.repository.js';
import { writeAudit } from '../repositories/audit.repository.js';
import { database } from '../repositories/database.js';
import { failure, success } from '../utils/api-response.js';

const requestSchema = z.object({
  cameraIds: z.array(z.string().uuid()).min(1).max(100),
  duration: z.enum(['TEMPORARY', 'PERMANENT']),
  reason: z.string().min(5).max(2000),
  expiresAt: z.string().datetime().optional().nullable()
}).superRefine((value, ctx) => {
  if (value.duration === 'TEMPORARY' && !value.expiresAt) {
    ctx.addIssue({ code: 'custom', message: 'Temporary access requires an expiration timestamp (expiresAt).' });
  }
});

const decisionSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  reason: z.string().min(3).max(2000)
});

export async function getRequests(req, res) {
  const direction = req.query.direction || 'all';
  const status = req.query.status;
  const limit = Math.min(Number(req.query.limit) || 25, 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  const data = await listAccessRequests(req.user, { direction, status, limit, offset });
  return success(res, data);
}

export async function getRequestById(req, res) {
  const accessRequest = await findRequest(req.params.id);
  if (!accessRequest) return failure(res, 'NOT_FOUND', 'Access request was not found.', 404);

  const isActor = isStateAdmin(req.user) ||
    accessRequest.requestingDepartmentId === req.user.departmentId ||
    accessRequest.ownerDepartmentId === req.user.departmentId;

  if (!isActor) {
    return failure(res, 'AUTHORIZATION_DENIED', 'You are not authorized to view this request.', 403);
  }

  return success(res, accessRequest);
}

export async function requestAccess(req, res) {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    return failure(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Invalid request input.', 400);
  }

  const input = parsed.data;
  if (!req.user.departmentId) {
    return failure(res, 'AUTHORIZATION_DENIED', 'A department assignment is required to request camera access.', 403);
  }

  const cameras = await database().query(
    `SELECT id, managing_department_id, city_id, (SELECT name FROM cities WHERE id = city_id) AS city
     FROM cameras WHERE id = ANY($1::uuid[]) AND active = true`,
    [input.cameraIds]
  );

  if (cameras.rows.length !== input.cameraIds.length) {
    return failure(res, 'INVALID_CAMERAS', 'One or more requested cameras were not found.', 400);
  }

  const owners = new Set(cameras.rows.map((c) => c.managing_department_id));
  if (owners.size !== 1) {
    return failure(res, 'INVALID_REQUEST', 'All cameras in a single access request must belong to the same managing department.', 400);
  }

  if (cameras.rows.some((c) => c.managing_department_id === req.user.departmentId)) {
    return failure(res, 'INVALID_REQUEST', 'Cannot request access to cameras already managed by your own department.', 400);
  }

  const created = await createAccessRequest({
    departmentId: req.user.departmentId,
    userId: req.user.id,
    cameraIds: input.cameraIds,
    duration: input.duration,
    reason: input.reason,
    expiresAt: input.expiresAt
  });

  await writeAudit({
    actorUserId: req.user.id,
    action: 'CAMERA_ACCESS_REQUESTED',
    entityType: 'CAMERA_ACCESS_REQUEST',
    entityId: created.id,
    requestId: req.id,
    detail: { cameraCount: input.cameraIds.length, duration: input.duration, reason: input.reason }
  });

  return success(res, created, 'Camera access request submitted successfully.', 201);
}

export async function decide(req, res) {
  const parsed = decisionSchema.safeParse(req.body);
  if (!parsed.success) {
    return failure(res, 'VALIDATION_ERROR', 'Decision reason is required.', 400);
  }

  const input = parsed.data;
  const accessRequest = await findRequest(req.params.id);
  if (!accessRequest) return failure(res, 'NOT_FOUND', 'Access request was not found.', 404);

  const override = isStateAdmin(req.user);
  if (!override && !canManageDepartment(req.user, accessRequest.ownerDepartmentId)) {
    return failure(res, 'AUTHORIZATION_DENIED', 'Only the managing Department Head or State Admin can decide this request.', 403);
  }

  const result = await decideRequest(accessRequest.id, {
    status: input.status,
    actorId: req.user.id,
    reason: input.reason,
    override
  });

  if (!result) {
    return failure(res, 'INVALID_STATE', 'Only pending requests can be decided.', 409);
  }

  await writeAudit({
    actorUserId: req.user.id,
    action: override ? `CAMERA_ACCESS_${input.status}_OVERRIDE` : `CAMERA_ACCESS_${input.status}`,
    entityType: 'CAMERA_ACCESS_REQUEST',
    entityId: result.id,
    requestId: req.id,
    detail: { decision: input.status, reason: input.reason, override }
  });

  return success(res, result, `Access request ${input.status.toLowerCase()} successfully.`);
}

export async function revoke(req, res) {
  const accessRequest = await findRequest(req.params.id);
  if (!accessRequest) return failure(res, 'NOT_FOUND', 'Access request was not found.', 404);

  const override = isStateAdmin(req.user);
  if (!override && !canManageDepartment(req.user, accessRequest.ownerDepartmentId)) {
    return failure(res, 'AUTHORIZATION_DENIED', 'You cannot revoke this grant.', 403);
  }

  const result = await revokeRequest(accessRequest.id, req.user.id);
  if (!result) {
    return failure(res, 'INVALID_STATE', 'Only approved grants can be revoked.', 409);
  }

  await writeAudit({
    actorUserId: req.user.id,
    action: 'CAMERA_ACCESS_REVOKED',
    entityType: 'CAMERA_ACCESS_REQUEST',
    entityId: result.id,
    requestId: req.id
  });

  return success(res, result, 'Camera access revoked successfully.');
}
