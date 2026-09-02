import { z } from 'zod';
import {
  listAlerts,
  findAlertById,
  acknowledgeAlert,
  resolveAlert,
  listAlertRules,
  createAlertRule
} from '../repositories/alert.repository.js';
import { writeAudit } from '../repositories/audit.repository.js';
import { failure, success } from '../utils/api-response.js';

const resolveSchema = z.object({
  resolutionNotes: z.string().min(3).max(2000)
});

const createRuleSchema = z.object({
  name: z.string().min(3),
  scope: z.enum(['DEPARTMENT', 'GLOBAL']).default('DEPARTMENT'),
  departmentId: z.string().uuid().optional(),
  conditions: z.record(z.any()).default({}),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM')
});

export async function getAlerts(req, res) {
  const limit = Math.min(Number(req.query.limit) || 25, 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const status = req.query.status;
  const severity = req.query.severity;
  const cityId = req.query.cityId;
  const departmentId = req.query.departmentId;

  const data = await listAlerts(req.user, { status, severity, cityId, departmentId, limit, offset });
  return success(res, data);
}

export async function getAlert(req, res) {
  const alert = await findAlertById(req.user, req.params.id);
  if (!alert) {
    return failure(res, 'ALERT_NOT_FOUND', 'Alert not found or unauthorized.', 404);
  }
  return success(res, alert);
}

export async function ackAlert(req, res) {
  const alert = await findAlertById(req.user, req.params.id);
  if (!alert) {
    return failure(res, 'ALERT_NOT_FOUND', 'Alert not found or unauthorized.', 404);
  }

  const result = await acknowledgeAlert(req.params.id, req.user.id);
  if (!result) {
    return failure(res, 'INVALID_STATE', 'Alert has already been acknowledged or resolved.', 409);
  }

  await writeAudit({
    actorUserId: req.user.id,
    action: 'ALERT_ACKNOWLEDGE',
    entityType: 'ALERT',
    entityId: req.params.id,
    requestId: req.id
  });

  return success(res, result, 'Alert acknowledged.');
}

export async function closeAlert(req, res) {
  const alert = await findAlertById(req.user, req.params.id);
  if (!alert) {
    return failure(res, 'ALERT_NOT_FOUND', 'Alert not found or unauthorized.', 404);
  }

  const parsed = resolveSchema.safeParse(req.body);
  if (!parsed.success) {
    return failure(res, 'VALIDATION_ERROR', 'Resolution notes are required.', 400);
  }

  const result = await resolveAlert(req.params.id, req.user.id, parsed.data.resolutionNotes);
  if (!result) {
    return failure(res, 'INVALID_STATE', 'Alert could not be resolved.', 409);
  }

  await writeAudit({
    actorUserId: req.user.id,
    action: 'ALERT_RESOLVE',
    entityType: 'ALERT',
    entityId: req.params.id,
    requestId: req.id,
    detail: { resolutionNotes: parsed.data.resolutionNotes }
  });

  return success(res, result, 'Alert marked as resolved.');
}

export async function getRules(req, res) {
  const rules = await listAlertRules(req.user);
  return success(res, rules);
}

export async function createRule(req, res) {
  const isStateAdmin = req.user.roles.includes('STATE_ADMIN');
  const isDeptHead = req.user.roles.includes('DEPARTMENT_HEAD');

  if (!isStateAdmin && !isDeptHead) {
    return failure(res, 'AUTHORIZATION_DENIED', 'Only State Admin and Department Heads can configure alert rules.', 403);
  }

  const parsed = createRuleSchema.safeParse(req.body);
  if (!parsed.success) {
    return failure(res, 'VALIDATION_ERROR', 'Invalid rule configuration.', 400);
  }

  const payload = parsed.data;
  if (!isStateAdmin && payload.scope === 'GLOBAL') {
    return failure(res, 'AUTHORIZATION_DENIED', 'Only State Admin can configure global alert rules.', 403);
  }

  if (!isStateAdmin) {
    payload.departmentId = req.user.departmentId;
  }

  const rule = await createAlertRule({
    name: payload.name,
    departmentId: payload.departmentId,
    scope: payload.scope,
    conditions: payload.conditions,
    severity: payload.severity,
    userId: req.user.id
  });

  await writeAudit({
    actorUserId: req.user.id,
    action: 'ALERT_RULE_CREATE',
    entityType: 'ALERT_RULE',
    entityId: rule.id,
    requestId: req.id,
    detail: { name: payload.name, severity: payload.severity, conditions: payload.conditions }
  });

  return success(res, rule, 'Alert rule created successfully.', 201);
}
