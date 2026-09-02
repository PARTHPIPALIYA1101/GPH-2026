import { ZodError } from 'zod';
import { failure } from '../utils/api-response.js';

export function notFound(req, res) {
  return failure(res, 'NOT_FOUND', `Route ${req.method} ${req.path} was not found.`, 404);
}

export function errorHandler(error, req, res, _next) {
  req.log?.error({ err: error, requestId: req.id }, 'Unhandled request error');
  if (error instanceof ZodError) return failure(res, 'VALIDATION_ERROR', 'Request validation failed.', 400);
  return failure(res, 'INTERNAL_ERROR', 'An unexpected server error occurred.', 500);
}
