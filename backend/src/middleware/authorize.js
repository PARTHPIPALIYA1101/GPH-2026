import { evaluateResourceAccess, hasAnyRole } from '../auth/authorization.js';
import { failure } from '../utils/api-response.js';

export const requireRoles = (...roles) => (req, res, next) => {
  if (!hasAnyRole(req.user, roles)) return failure(res, 'AUTHORIZATION_DENIED', 'Your assigned roles do not permit this action.', 403);
  return next();
};

export const requireResourceAccess = (resolveResource) => async (req, res, next) => {
  const resource = await resolveResource(req);
  if (!resource) return failure(res, 'NOT_FOUND', 'Requested resource was not found.', 404);
  const result = evaluateResourceAccess({ user: req.user, ...resource });
  if (!result.allowed) return failure(res, 'AUTHORIZATION_DENIED', 'You are not authorized to access this resource.', 403);
  req.authorizedResource = resource;
  return next();
};
