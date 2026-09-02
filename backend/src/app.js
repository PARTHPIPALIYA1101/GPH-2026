import cors from 'cors';
import express from 'express';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { errorHandler, notFound } from './middleware/error-handler.js';
import { requestContext } from './middleware/request-context.js';
import { healthRouter } from './routes/health.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { userRouter } from './routes/user.routes.js';
import { departmentRouter } from './routes/department.routes.js';
import { cityRouter } from './routes/city.routes.js';
import { cameraRouter } from './routes/camera.routes.js';
import { accessRequestRouter } from './routes/access-request.routes.js';
import { streamRouter } from './routes/stream.routes.js';
import { aiRouter } from './routes/ai.routes.js';
import { searchRouter } from './routes/search.routes.js';
import { watchlistRouter } from './routes/watchlist.routes.js';
import { alertRouter } from './routes/alert.routes.js';
import { investigationRouter } from './routes/investigation.routes.js';
import { evidenceRouter } from './routes/evidence.routes.js';
import { reportRouter } from './routes/report.routes.js';
import { auditRouter } from './routes/audit.routes.js';

export function createApp() {
  const app = express();
  const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

  app.disable('x-powered-by');
  app.use(requestContext);
  app.use(pinoHttp({ logger, genReqId: (req) => req.id }));
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '2mb' }));

  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/users', userRouter);
  app.use('/api/departments', departmentRouter);
  app.use('/api/cities', cityRouter);
  app.use('/api/cameras', cameraRouter);
  app.use('/api/access-requests', accessRequestRouter);
  app.use('/api/streams', streamRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api/search', searchRouter);
  app.use('/api/watchlists', watchlistRouter);
  app.use('/api/alerts', alertRouter);
  app.use('/api/investigations', investigationRouter);
  app.use('/api/evidence', evidenceRouter);
  app.use('/api/reports', reportRouter);
  app.use('/api/audit', auditRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
