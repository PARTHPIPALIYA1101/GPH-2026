import { z } from 'zod';
import { listUsers, createUser, updateUserStatus, findUserById } from '../repositories/user.repository.js';
import { writeAudit } from '../repositories/audit.repository.js';
import { failure, success } from '../utils/api-response.js';

const createUserSchema = z.object({
  departmentId: z.string().uuid().optional(),
  email: z.string().email(),
  displayName: z.string().min(2),
  password: z.string().min(8),
  roles: z.array(z.enum(['STATE_ADMIN', 'DEPARTMENT_HEAD', 'OFFICER', 'OPERATOR', 'INVESTIGATOR'])).min(1),
  cityIds: z.array(z.string().uuid()).default([]),
  administrativeScope: z.record(z.any()).default({})
});

const updateStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DISABLED'])
});

export async function getUsers(req, res) {
  const departmentId = req.user.roles.includes('STATE_ADMIN') ? req.query.departmentId : req.user.departmentId;
  const status = req.query.status;
  const role = req.query.role;
  const limit = Math.min(Number(req.query.limit) || 25, 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  const data = await listUsers({ departmentId, status, role, limit, offset });
  return success(res, data);
}

export async function getUserById(req, res) {
  const user = await findUserById(req.params.id);
  if (!user) return failure(res, 'NOT_FOUND', 'User not found.', 404);

  if (!req.user.roles.includes('STATE_ADMIN') && user.departmentId !== req.user.departmentId) {
    return failure(res, 'AUTHORIZATION_DENIED', 'You can only view users in your own department.', 403);
  }

  return success(res, user);
}

export async function createNewUser(req, res) {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return failure(res, 'VALIDATION_ERROR', 'Invalid user data provided.', 400);
  }

  const payload = parsed.data;
  const isStateAdmin = req.user.roles.includes('STATE_ADMIN');
  const isDeptHead = req.user.roles.includes('DEPARTMENT_HEAD');

  if (!isStateAdmin && !isDeptHead) {
    return failure(res, 'AUTHORIZATION_DENIED', 'Only State Admin and Department Heads can create users.', 403);
  }

  if (isDeptHead && !isStateAdmin) {
    // Department Head can only create Officer, Operator, Investigator for their department
    if (payload.departmentId && payload.departmentId !== req.user.departmentId) {
      return failure(res, 'AUTHORIZATION_DENIED', 'You cannot create users for other departments.', 403);
    }
    payload.departmentId = req.user.departmentId;

    const invalidRoles = payload.roles.filter((r) => r === 'STATE_ADMIN' || r === 'DEPARTMENT_HEAD');
    if (invalidRoles.length > 0) {
      return failure(res, 'AUTHORIZATION_DENIED', 'Department Heads cannot create State Admins or Department Heads.', 403);
    }
  }

  try {
    const newUser = await createUser(payload);

    await writeAudit({
      actorUserId: req.user.id,
      action: 'USER_CREATE',
      entityType: 'USER',
      entityId: newUser.id,
      requestId: req.id,
      detail: { email: newUser.email, roles: payload.roles, departmentId: payload.departmentId }
    });

    return success(res, newUser, 'User created successfully.', 201);
  } catch (err) {
    if (err.code === '23505') {
      return failure(res, 'DUPLICATE_EMAIL', 'A user with this email address already exists.', 409);
    }
    throw err;
  }
}

export async function changeUserStatus(req, res) {
  const parsed = updateStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return failure(res, 'VALIDATION_ERROR', 'Invalid status provided.', 400);
  }

  const targetUser = await findUserById(req.params.id);
  if (!targetUser) return failure(res, 'NOT_FOUND', 'User not found.', 404);

  const isStateAdmin = req.user.roles.includes('STATE_ADMIN');
  const isDeptHead = req.user.roles.includes('DEPARTMENT_HEAD');

  if (!isStateAdmin && (!isDeptHead || targetUser.departmentId !== req.user.departmentId)) {
    return failure(res, 'AUTHORIZATION_DENIED', 'You do not have permission to modify this user.', 403);
  }

  const updated = await updateUserStatus(req.params.id, parsed.data.status);

  await writeAudit({
    actorUserId: req.user.id,
    action: `USER_${parsed.data.status}`,
    entityType: 'USER',
    entityId: req.params.id,
    requestId: req.id,
    detail: { previousStatus: targetUser.status, newStatus: parsed.data.status, email: targetUser.email }
  });

  return success(res, updated, `User status updated to ${parsed.data.status}.`);
}
