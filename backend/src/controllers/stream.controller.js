import { z } from 'zod';
import { authorizeStreamSession, releaseStreamSession, getActiveSessionStats } from '../services/stream-session.service.js';
import { failure, success } from '../utils/api-response.js';

const streamRequestSchema = z.object({
  cameraId: z.string().uuid(),
  streamType: z.enum(['RAW', 'AI_ANNOTATED']).default('AI_ANNOTATED')
});

const releaseSchema = z.object({
  sessionId: z.string()
});

export async function openStream(req, res) {
  const parsed = streamRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return failure(res, 'VALIDATION_ERROR', 'Valid cameraId is required.', 400);
  }

  try {
    const session = await authorizeStreamSession(req.user, parsed.data.cameraId, parsed.data.streamType);
    return success(res, session, 'Live stream session authorized.');
  } catch (err) {
    return failure(res, 'STREAM_AUTHORIZATION_DENIED', err.message, 403);
  }
}

export function closeStream(req, res) {
  const parsed = releaseSchema.safeParse(req.body);
  if (!parsed.success) {
    return failure(res, 'VALIDATION_ERROR', 'Valid sessionId is required.', 400);
  }

  const result = releaseStreamSession(parsed.data.sessionId, req.user.id);
  return success(res, result, 'Live stream session closed and resources released.');
}

export function getStats(req, res) {
  const stats = getActiveSessionStats(req.user.id);
  return success(res, stats);
}
