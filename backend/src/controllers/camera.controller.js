import { z } from 'zod';
import {
  listAuthorizedCameras,
  findCameraById,
  createCamera,
  updateCamera,
  deleteCamera,
  updateCameraHealth,

  getCameraOperationalSummary,
  mapClusters
} from '../repositories/camera.repository.js';
import { writeAudit } from '../repositories/audit.repository.js';
import { failure, success } from '../utils/api-response.js';

const createCameraSchema = z.object({
  externalId: z.string().min(1, 'External ID must be at least 1 character'),
  cameraNumber: z.string().optional(),
  name: z.string().min(1, 'Camera name must be at least 1 character'),
  departmentId: z.preprocess((val) => (val === '' || val === null ? undefined : val), z.string().uuid('Invalid Department ID').optional()),
  cityId: z.string().uuid('City must be selected'),
  location: z.string().min(1, 'Location description must be at least 1 character'),
  streamProtocol: z.string().optional().default('RTSP'),
  streamReference: z.string().optional(),
  latitude: z.preprocess(
    (val) => (val === '' || val === undefined || val === null || isNaN(Number(val)) ? undefined : Number(val)),
    z.number().optional()
  ),
  longitude: z.preprocess(
    (val) => (val === '' || val === undefined || val === null || isNaN(Number(val)) ? undefined : Number(val)),
    z.number().optional()
  ),
  metadata: z.record(z.any()).default({})
});

const updateCameraSchema = z.object({
  name: z.string().min(1).optional(),
  location: z.string().min(1).optional(),
  streamProtocol: z.string().optional(),
  streamReference: z.string().optional(),
  latitude: z.preprocess(
    (val) => (val === '' || val === undefined || val === null || isNaN(Number(val)) ? undefined : Number(val)),
    z.number().optional()
  ),
  longitude: z.preprocess(
    (val) => (val === '' || val === undefined || val === null || isNaN(Number(val)) ? undefined : Number(val)),
    z.number().optional()
  ),
  metadata: z.record(z.any()).optional()
});


export async function getCameras(req, res) {
  const limit = Math.min(Number(req.query.limit) || 25, 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const city = req.query.city;
  const departmentId = req.query.departmentId;
  const status = req.query.status;
  const aiStatus = req.query.aiStatus;
  const search = req.query.search;

  const data = await listAuthorizedCameras(req.user, { limit, offset, city, departmentId, status, aiStatus, search });
  return success(res, data);
}

export async function getCamera(req, res) {
  const camera = await findCameraById(req.user, req.params.id);
  if (!camera) {
    return failure(res, 'CAMERA_NOT_FOUND', 'Camera not found or you are not authorized to view it.', 404);
  }
  return success(res, camera);
}

export async function getSummary(req, res) {
  const summary = await getCameraOperationalSummary(req.user);
  return success(res, summary);
}

export async function getMap(req, res) {
  const zoom = Number(req.query.zoom) || 7;
  const city = req.query.city;
  const status = req.query.status;
  const departmentId = req.query.departmentId;

  const clusters = await mapClusters(req.user, { zoom, city, status, departmentId });
  return success(res, clusters);
}

export async function registerNewCamera(req, res) {
  const isStateAdmin = req.user.roles.includes('STATE_ADMIN');
  const isDeptHead = req.user.roles.includes('DEPARTMENT_HEAD');

  if (!isStateAdmin && !isDeptHead) {
    return failure(res, 'AUTHORIZATION_DENIED', 'Only State Admin and Department Heads can register cameras.', 403);
  }

  const parsed = createCameraSchema.safeParse(req.body);
  if (!parsed.success) {
    const errorDetails = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    return failure(res, 'VALIDATION_ERROR', `Invalid camera data (${errorDetails}).`, 400);
  }


  const payload = parsed.data;
  if (!isStateAdmin) {
    payload.departmentId = req.user.departmentId;
  } else if (!payload.departmentId) {
    payload.departmentId = req.user.departmentId;
  }

  try {
    const camera = await createCamera(payload);

    await writeAudit({
      actorUserId: req.user.id,
      action: 'CAMERA_REGISTER',
      entityType: 'CAMERA',
      entityId: camera.id,
      requestId: req.id,
      detail: { externalId: camera.externalId, name: payload.name, departmentId: payload.departmentId }
    });

    return success(res, camera, 'Camera registered successfully. Initial status is CONNECTING.', 201);
  } catch (err) {
    if (err.code === '23505') {
      return failure(res, 'DUPLICATE_EXTERNAL_ID', 'A camera with this external ID already exists.', 409);
    }
    throw err;
  }
}

export async function updateCameraInfo(req, res) {
  const isStateAdmin = req.user.roles.includes('STATE_ADMIN');
  const isDeptHead = req.user.roles.includes('DEPARTMENT_HEAD');

  if (!isStateAdmin && !isDeptHead) {
    return failure(res, 'AUTHORIZATION_DENIED', 'Only State Admin and Department Heads can edit cameras.', 403);
  }

  const camera = await findCameraById(req.user, req.params.id);
  if (!camera) {
    return failure(res, 'CAMERA_NOT_FOUND', 'Camera not found or unauthorized.', 404);
  }

  if (!isStateAdmin && camera.departmentId !== req.user.departmentId) {
    return failure(res, 'AUTHORIZATION_DENIED', 'You can only modify cameras managed by your department.', 403);
  }

  const parsed = updateCameraSchema.safeParse(req.body);
  if (!parsed.success) {
    return failure(res, 'VALIDATION_ERROR', 'Invalid update parameters.', 400);
  }

  const updated = await updateCamera(req.params.id, parsed.data);

  await writeAudit({
    actorUserId: req.user.id,
    action: 'CAMERA_UPDATE',
    entityType: 'CAMERA',
    entityId: req.params.id,
    requestId: req.id,
    detail: parsed.data
  });

  return success(res, updated, 'Camera details updated successfully.');
}

export async function decommissionCamera(req, res) {
  const isStateAdmin = req.user.roles.includes('STATE_ADMIN');
  const isDeptHead = req.user.roles.includes('DEPARTMENT_HEAD');

  if (!isStateAdmin && !isDeptHead) {
    return failure(res, 'AUTHORIZATION_DENIED', 'Only State Admin and Department Heads can delete/decommission camera assets.', 403);
  }

  const camera = await findCameraById(req.user, req.params.id);
  if (!camera) {
    return failure(res, 'CAMERA_NOT_FOUND', 'Camera not found or unauthorized.', 404);
  }

  if (!isStateAdmin && camera.departmentId !== req.user.departmentId) {
    return failure(res, 'AUTHORIZATION_DENIED', 'You can only delete cameras managed by your department.', 403);
  }

  const deleted = await deleteCamera(req.params.id);

  await writeAudit({
    actorUserId: req.user.id,
    action: 'CAMERA_DELETE',
    entityType: 'CAMERA',
    entityId: req.params.id,
    requestId: req.id,
    detail: { externalId: camera.externalId, name: camera.name }
  });

  return success(res, deleted, 'Camera asset decommissioned successfully.');
}

