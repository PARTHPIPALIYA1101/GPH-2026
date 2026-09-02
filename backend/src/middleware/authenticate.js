import { verifyAccessToken } from '../auth/token.js';
import { findUserById } from '../repositories/user.repository.js';
import { failure } from '../utils/api-response.js';

export async function authenticate(req, res, next) {
  const token = req.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return failure(res, 'AUTHENTICATION_REQUIRED', 'Bearer token is required.', 401);
  try {
    const claims = verifyAccessToken(token);
    const user = await findUserById(claims.sub);
    if (!user || user.status !== 'ACTIVE') {
      return failure(res, 'ACCOUNT_UNAVAILABLE', 'User account is suspended, disabled, or unavailable.', 403);
    }
    req.user = user;
    return next();
  } catch (err) {
    return failure(res, 'INVALID_TOKEN', 'Authentication token is invalid or expired.', 401);
  }
}
