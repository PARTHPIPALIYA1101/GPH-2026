import { Router } from 'express';
import { getAiStatus, getAiJobs, startProcessingJob, stopProcessingJob, simulateDetectionEvent, ingestDetectionEvent } from '../controllers/ai.controller.js';
import { authenticate } from '../middleware/authenticate.js';

export const aiRouter = Router();

// Unauthenticated service endpoint for internal AI detection ingest
aiRouter.post('/detections/ingest', ingestDetectionEvent);

aiRouter.use(authenticate);

aiRouter.get('/status', getAiStatus);
aiRouter.get('/jobs', getAiJobs);
aiRouter.post('/jobs', startProcessingJob);
aiRouter.post('/jobs/:jobId/stop', stopProcessingJob);
aiRouter.post('/simulate-detection', simulateDetectionEvent);

