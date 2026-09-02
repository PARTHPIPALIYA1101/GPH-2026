import { z } from 'zod';
import { listDepartments, findDepartmentById, createDepartment } from '../repositories/department.repository.js';
import { writeAudit } from '../repositories/audit.repository.js';
import { failure, success } from '../utils/api-response.js';

const createDeptSchema = z.object({
  code: z.string().min(2).max(20),
  name: z.string().min(3),
  category: z.string().min(2)
});

export async function getDepartments(req, res) {
  const departments = await listDepartments();
  return success(res, departments);
}

export async function getDepartmentById(req, res) {
  const dept = await findDepartmentById(req.params.id);
  if (!dept) return failure(res, 'NOT_FOUND', 'Department not found.', 404);
  return success(res, dept);
}

export async function createNewDepartment(req, res) {
  if (!req.user.roles.includes('STATE_ADMIN')) {
    return failure(res, 'AUTHORIZATION_DENIED', 'Only State Admin can create new departments.', 403);
  }

  const parsed = createDeptSchema.safeParse(req.body);
  if (!parsed.success) {
    return failure(res, 'VALIDATION_ERROR', 'Invalid department parameters.', 400);
  }

  try {
    const dept = await createDepartment(parsed.data);

    await writeAudit({
      actorUserId: req.user.id,
      action: 'DEPARTMENT_CREATE',
      entityType: 'DEPARTMENT',
      entityId: dept.id,
      requestId: req.id,
      detail: parsed.data
    });

    return success(res, dept, 'Department created successfully.', 201);
  } catch (err) {
    if (err.code === '23505') {
      return failure(res, 'DUPLICATE_CODE', 'Department code must be unique.', 409);
    }
    throw err;
  }
}
