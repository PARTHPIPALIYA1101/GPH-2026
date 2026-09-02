import { z } from 'zod';
import { env } from '../config/env.js';
import { getAiClient } from '../ai/ai-client.js';
import { createAiJob, listAiJobs, updateAiJobStatus } from '../repositories/ai.repository.js';
import { findCameraById, findCameraByIdUnrestricted } from '../repositories/camera.repository.js';
import { eventBus } from '../events/event-bus.js';
import { failure, success } from '../utils/api-response.js';

const startJobSchema = z.object({
  cameraId: z.string().uuid(),
  profile: z.string().default('standard_surveillance'),
  priority: z.string().default('normal')
});

const simulateEventSchema = z.object({
  cameraId: z.string().uuid(),
  plateNumber: z.string().optional(),
  vehicleType: z.string().optional().default('SUV'),
  vehicleColor: z.string().optional().default('WHITE'),
  detectionType: z.enum(['PLATE', 'VEHICLE', 'PERSON', 'OBJECT']).default('PLATE'),
  confidence: z.number().min(0).max(1).default(0.95)
});

export async function getAiStatus(req, res) {
  const isConfigured = Boolean(env.AI_MODEL_API_URL);
  const client = getAiClient();
  const ready = await client.isConfigured();

  return success(res, {
    status: isConfigured ? 'CONFIGURED' : 'NOT_CONFIGURED',
    clientMode: env.AI_CLIENT_MODE,
    isReady: ready,
    apiUrlConfigured: Boolean(env.AI_MODEL_API_URL)
  });
}

export async function getAiJobs(req, res) {
  const status = req.query.status;
  const limit = Math.min(Number(req.query.limit) || 25, 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  const data = await listAiJobs({ status, limit, offset });
  return success(res, data);
}

export async function startProcessingJob(req, res) {
  const parsed = startJobSchema.safeParse(req.body);
  if (!parsed.success) {
    return failure(res, 'VALIDATION_ERROR', 'Valid cameraId is required.', 400);
  }

  const camera = await findCameraById(req.user, parsed.data.cameraId);
  if (!camera) {
    return failure(res, 'CAMERA_NOT_FOUND', 'Camera not found or not authorized.', 404);
  }

  const aiClient = getAiClient();
  try {
    const aiRes = await aiClient.startJob({
      cameraId: camera.id,
      streamUrl: camera.streamReference,
      profile: parsed.data.profile,
      priority: parsed.data.priority
    });

    const job = await createAiJob({
      cameraId: camera.id,
      externalJobId: aiRes.externalJobId,
      profile: parsed.data.profile,
      priority: parsed.data.priority
    });

    return success(res, { job, stream: aiRes }, 'AI processing job initiated.', 201);
  } catch (err) {
    return failure(res, 'AI_JOB_ERROR', err.message, 502);
  }
}

export async function stopProcessingJob(req, res) {
  const aiClient = getAiClient();
  try {
    await aiClient.stopJob(req.params.jobId);
    const updated = await updateAiJobStatus(req.params.jobId, 'STOPPED');
    return success(res, updated, 'AI processing job stopped.');
  } catch (err) {
    return failure(res, 'AI_JOB_ERROR', err.message, 502);
  }
}

export async function simulateDetectionEvent(req, res) {
  const parsed = simulateEventSchema.safeParse(req.body);
  if (!parsed.success) {
    return failure(res, 'VALIDATION_ERROR', 'Invalid simulation payload.', 400);
  }

  const camera = await findCameraById(req.user, parsed.data.cameraId);
  if (!camera) {
    return failure(res, 'CAMERA_NOT_FOUND', 'Camera not found or unauthorized.', 404);
  }

  const eventPayload = {
    cameraId: camera.id,
    cityId: camera.cityId,
    departmentId: camera.departmentId,
    detectionType: parsed.data.detectionType,
    confidence: parsed.data.confidence,
    trackId: `TRK-SIM-${Date.now().toString().slice(-4)}`,
    plateNumber: parsed.data.plateNumber,
    vehicleType: parsed.data.vehicleType,
    vehicleColor: parsed.data.vehicleColor,
    evidenceUrl: `https://storage.internal.gov.in/evidence/${camera.id}/snap_${Date.now()}.jpg`
  };

  eventBus.publish('ai.detections', eventPayload);

  return success(res, { eventPublished: true, payload: eventPayload }, 'Simulated AI intelligence event dispatched.');
}

export async function ingestDetectionEvent(req, res) {
  const { cameraId, detectionType, confidence, trackId, plateNumber, vehicleType, vehicleColor, evidenceUrl } = req.body || {};
  if (!cameraId) {
    return failure(res, 'VALIDATION_ERROR', 'cameraId is required.', 400);
  }

  const camera = await findCameraByIdUnrestricted(cameraId);
  if (!camera) {
    return failure(res, 'CAMERA_NOT_FOUND', 'Camera not found.', 404);
  }

  const eventPayload = {
    cameraId: camera.id,
    cityId: camera.cityId,
    departmentId: camera.departmentId,
    detectionType: detectionType || 'PLATE',
    confidence: Number(confidence) || 0.9,
    trackId: trackId || `TRK-${Date.now().toString().slice(-4)}`,
    plateNumber: plateNumber || null,
    vehicleType: vehicleType || 'CAR',
    vehicleColor: vehicleColor || 'WHITE',
    evidenceUrl: evidenceUrl || `${env.AI_MODEL_API_URL || ''}/api/v1/streams/${camera.id}/mjpeg`
  };

  eventBus.publish('ai.detections', eventPayload);

  return success(res, { eventPublished: true, payload: eventPayload }, 'AI intelligence detection ingested successfully.');
}

