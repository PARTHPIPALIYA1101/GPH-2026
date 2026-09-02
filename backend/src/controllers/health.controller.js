import { env } from '../config/env.js';
import { readiness } from '../services/dependency-health.service.js';
import { success } from '../utils/api-response.js';

export const live = (_req, res) => success(res, { status: 'UP' });

export async function ready(_req, res) {
  const result = await readiness();
  const isReady = result.dependencies?.database?.status !== 'DOWN';
  return success(
    res,
    { status: isReady ? 'READY' : 'DEGRADED', dependencies: result.dependencies },
    undefined,
    isReady ? 200 : 503
  );
}

export const overview = (_req, res) => success(res, {
  service: 'gujarat-video-intelligence-api',
  environment: env.APP_ENV,
  ai: { status: env.AI_MODEL_API_URL ? 'CONFIGURED' : 'NOT_CONFIGURED', clientMode: env.AI_CLIENT_MODE },
  maximumLiveViews: env.MAX_LIVE_VIEWS
});
