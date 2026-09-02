import { z } from 'zod';
import { createAccessToken } from '../auth/token.js';
import { findUserByEmail, updateLastLogin } from '../repositories/user.repository.js';
import { writeAudit } from '../repositories/audit.repository.js';
import { failure, success } from '../utils/api-response.js';
import { database } from '../repositories/database.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export async function login(req, res) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return failure(res, 'VALIDATION_ERROR', 'Invalid credentials format provided.', 400);
  }

  const { email, password } = parsed.data;
  const user = await findUserByEmail(email);
  if (!user || user.status !== 'ACTIVE') {
    return failure(res, 'INVALID_CREDENTIALS', 'Invalid email, password, or account is disabled.', 401);
  }

  // Verify password with PostgreSQL pgcrypto crypt
  const checkRes = await database().query(
    `SELECT (password_hash = crypt($1, password_hash)) AS "isValid" FROM users WHERE id = $2`,
    [password, user.id]
  );

  if (!checkRes.rows[0]?.isValid) {
    return failure(res, 'INVALID_CREDENTIALS', 'Invalid email or password.', 401);
  }

  await updateLastLogin(user.id);
  const token = createAccessToken(user);

  await writeAudit({
    actorUserId: user.id,
    action: 'USER_LOGIN',
    entityType: 'USER',
    entityId: user.id,
    requestId: req.id,
    detail: { email: user.email, roles: user.roles, department: user.departmentName }
  });

  return success(res, {
    token,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      departmentId: user.departmentId,
      departmentCode: user.departmentCode,
      departmentName: user.departmentName,
      roles: user.roles,
      cities: user.cities,
      status: user.status
    }
  }, 'Authenticated successfully.');
}

export function me(req, res) {
  return success(res, req.user);
}

export async function logout(req, res) {
  if (req.user) {
    await writeAudit({
      actorUserId: req.user.id,
      action: 'USER_LOGOUT',
      entityType: 'USER',
      entityId: req.user.id,
      requestId: req.id,
      detail: { email: req.user.email }
    });
  }
  return success(res, { loggedOut: true }, 'Logged out successfully.');
}
