import crypto from 'crypto';
import { env } from '../config/env.js';
import { findCameraById } from '../repositories/camera.repository.js';
import { getAiClient } from '../ai/ai-client.js';

// Map of active stream sessions: sessionId -> { userId, cameraId, streamType, startedAt }
const activeSessions = new Map();
const userSessionCounts = new Map();

export async function authorizeStreamSession(user, cameraId, streamType = 'AI_ANNOTATED') {
  const camera = await findCameraById(user, cameraId);
  if (!camera) {
    throw new Error('Camera not found or access not authorized.');
  }

  const currentActive = userSessionCounts.get(user.id) || 0;
  if (currentActive >= env.MAX_LIVE_VIEWS) {
    throw new Error(`Maximum concurrent live views (${env.MAX_LIVE_VIEWS}) reached. Please close an active stream before opening another.`);
  }

  const sessionId = `stream_sess_${crypto.randomBytes(12).toString('hex')}`;
  const aiClient = getAiClient();
  let streamInfo = {};

  if (streamType === 'RAW') {
    streamInfo = {
      protocol: camera.streamProtocol || 'HLS',
      streamUrl: camera.streamReference || `https://stream.internal.gov.in/raw/${camera.externalId}.m3u8`,
      isRaw: true,
      aiAnnotated: false
    };
  } else {
    // AI Annotated Stream
    const isAiReady = await aiClient.isConfigured();
    if (!isAiReady) {
      // Fallback gracefully to raw stream if AI is not configured
      streamInfo = {
        protocol: camera.streamProtocol || 'HLS',
        streamUrl: camera.streamReference || `https://stream.internal.gov.in/raw/${camera.externalId}.m3u8`,
        isRaw: true,
        aiAnnotated: false,
        warning: 'AI Model API is not configured. Falling back to Raw Stream.'
      };
    } else {
      const aiStream = await aiClient.getStreamInfo(camera.id);
      streamInfo = {
        protocol: aiStream.protocol || 'WHEP',
        webrtcEndpoint: aiStream.webrtcEndpoint || `/api/ai/streams/${camera.id}/whep`,
        streamUrl: aiStream.hlsUrl || camera.streamReference,
        isRaw: false,
        aiAnnotated: true
      };
    }
  }

  activeSessions.set(sessionId, {
    userId: user.id,
    cameraId,
    streamType,
    startedAt: Date.now()
  });
  userSessionCounts.set(user.id, currentActive + 1);

  return {
    sessionId,
    cameraId: camera.id,
    cameraName: camera.name,
    externalId: camera.externalId,
    streamType,
    streamInfo,
    maxAllowedViews: env.MAX_LIVE_VIEWS,
    activeUserViews: currentActive + 1
  };
}

export function releaseStreamSession(sessionId, userId) {
  const session = activeSessions.get(sessionId);
  if (!session) return { released: false };

  activeSessions.delete(sessionId);
  const currentCount = userSessionCounts.get(userId || session.userId) || 1;
  userSessionCounts.set(userId || session.userId, Math.max(0, currentCount - 1));

  return { released: true, sessionId };
}

export function getActiveSessionStats(userId) {
  return {
    activeViews: userSessionCounts.get(userId) || 0,
    maxViews: env.MAX_LIVE_VIEWS
  };
}
