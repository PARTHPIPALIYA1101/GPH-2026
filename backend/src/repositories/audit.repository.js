import { database } from './database.js';

export async function writeAudit({
  actorUserId,
  action,
  entityType,
  entityId,
  requestId,
  ipAddress,
  userAgent,
  detail = {}
}) {
  try {
    await database().query(
      `INSERT INTO audit_events (
        actor_user_id, action, entity_type, entity_id, request_id, detail
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [actorUserId || null, action, entityType, entityId || null, requestId || null, JSON.stringify(detail)]
    );
  } catch (err) {
    // Non-blocking logging safeguard
    console.error('Failed to write audit event:', err.message);
  }
}

export async function listAuditLogs(user, { action, entityType, dateFrom, dateTo, limit = 25, offset = 0 }) {
  const values = [];
  const filters = [];

  if (!user.roles.includes('STATE_ADMIN')) {
    // Department Head can only see their department's users and entities
    values.push(user.departmentId);
    filters.push(`(u.department_id = $1 OR (ae.detail->>'departmentId')::text = $1::text)`);
  }

  if (action) {
    values.push(action);
    filters.push(`ae.action = $${values.length}`);
  }
  if (entityType) {
    values.push(entityType);
    filters.push(`ae.entity_type = $${values.length}`);
  }
  if (dateFrom) {
    values.push(dateFrom);
    filters.push(`ae.created_at >= $${values.length}`);
  }
  if (dateTo) {
    values.push(dateTo);
    filters.push(`ae.created_at <= $${values.length}`);
  }

  const where = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
  const listValues = [...values, limit, offset];
  const limitParam = values.length + 1;
  const offsetParam = values.length + 2;

  const [items, count] = await Promise.all([
    database().query(
      `SELECT ae.id, ae.action, ae.entity_type AS "entityType", ae.entity_id AS "entityId",
        ae.request_id AS "requestId", ae.detail, ae.created_at AS "createdAt",
        u.display_name AS "actorName", u.email AS "actorEmail",
        d.name AS "actorDepartment"
       FROM audit_events ae
       LEFT JOIN users u ON u.id = ae.actor_user_id
       LEFT JOIN departments d ON d.id = u.department_id
       ${where}
       ORDER BY ae.created_at DESC
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
      listValues
    ),
    database().query(
      `SELECT count(*)
       FROM audit_events ae
       LEFT JOIN users u ON u.id = ae.actor_user_id
       ${where}`,
      values
    )
  ]);

  return { items: items.rows, total: Number(count.rows[0]?.count || 0) };
}
