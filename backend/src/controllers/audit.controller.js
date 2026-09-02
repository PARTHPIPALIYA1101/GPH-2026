import { listAuditLogs } from '../repositories/audit.repository.js';
import { failure, success } from '../utils/api-response.js';

export async function getAuditLogs(req, res) {
  const isStateAdmin = req.user.roles.includes('STATE_ADMIN');
  const isDeptHead = req.user.roles.includes('DEPARTMENT_HEAD');

  if (!isStateAdmin && !isDeptHead) {
    return failure(res, 'AUTHORIZATION_DENIED', 'Only State Admin and Department Heads can view audit logs.', 403);
  }

  const limit = Math.min(Number(req.query.limit) || 25, 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const action = req.query.action;
  const entityType = req.query.entityType;
  const dateFrom = req.query.dateFrom;
  const dateTo = req.query.dateTo;

  const data = await listAuditLogs(req.user, { action, entityType, dateFrom, dateTo, limit, offset });
  return success(res, data);
}
