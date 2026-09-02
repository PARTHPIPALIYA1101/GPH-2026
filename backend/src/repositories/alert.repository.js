import { database } from './database.js';

function buildAlertAuthorizationFilter(user, values) {
  if (user.roles.includes('STATE_ADMIN')) {
    return '1=1';
  }
  values.push(user.departmentId, user.cities || []);
  const deptParam = values.length - 1;
  const citiesParam = values.length;

  return `(
    (a.department_id = $${deptParam} OR EXISTS (
      SELECT 1 FROM camera_access_requests ar
      JOIN camera_access_request_cameras arc ON arc.request_id = ar.id
      WHERE arc.camera_id = a.camera_id
        AND ar.requesting_department_id = $${deptParam}
        AND ar.status = 'APPROVED'
        AND (ar.expires_at IS NULL OR ar.expires_at > now())
    ))
    AND city.name = ANY($${citiesParam})
  )`;
}

export async function listAlerts(user, { status, severity, cityId, departmentId, limit = 25, offset = 0 }) {
  const values = [];
  const filters = [];

  filters.push(buildAlertAuthorizationFilter(user, values));

  if (status) {
    values.push(status);
    filters.push(`a.status = $${values.length}::alert_status`);
  }
  if (severity) {
    values.push(severity);
    filters.push(`a.severity = $${values.length}::severity_level`);
  }
  if (cityId) {
    values.push(cityId);
    filters.push(`a.city_id = $${values.length}`);
  }
  if (departmentId) {
    values.push(departmentId);
    filters.push(`a.department_id = $${values.length}`);
  }

  const where = filters.join(' AND ');
  const listValues = [...values, limit, offset];
  const limitParam = values.length + 1;
  const offsetParam = values.length + 2;

  const [items, count] = await Promise.all([
    database().query(
      `SELECT a.id, a.severity, a.title, a.description, a.status, a.created_at AS "createdAt",
        a.acknowledged_at AS "acknowledgedAt", a.resolved_at AS "resolvedAt", a.resolution_notes AS "resolutionNotes",
        a.metadata,
        c.id AS "cameraId", c.name AS "cameraName", c.external_id AS "cameraExternalId",
        c.location_description AS "cameraLocation",
        city.id AS "cityId", city.name AS "cityName",
        d.id AS "departmentId", d.name AS "departmentName", d.code AS "departmentCode",
        u_ack.display_name AS "acknowledgedByName",
        u_res.display_name AS "resolvedByName"
       FROM alerts a
       JOIN cameras c ON c.id = a.camera_id
       JOIN cities city ON city.id = a.city_id
       JOIN departments d ON d.id = a.department_id
       LEFT JOIN users u_ack ON u_ack.id = a.acknowledged_by
       LEFT JOIN users u_res ON u_res.id = a.resolved_by
       WHERE ${where}
       ORDER BY a.created_at DESC
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
      listValues
    ),
    database().query(
      `SELECT count(*)
       FROM alerts a
       JOIN cameras c ON c.id = a.camera_id
       JOIN cities city ON city.id = a.city_id
       JOIN departments d ON d.id = a.department_id
       WHERE ${where}`,
      values
    )
  ]);

  return { items: items.rows, total: Number(count.rows[0]?.count || 0) };
}

export async function findAlertById(user, id) {
  const values = [id];
  const authFilter = buildAlertAuthorizationFilter(user, values);

  const result = await database().query(
    `SELECT a.id, a.severity, a.title, a.description, a.status, a.created_at AS "createdAt",
      a.acknowledged_at AS "acknowledgedAt", a.resolved_at AS "resolvedAt", a.resolution_notes AS "resolutionNotes",
      a.metadata, a.detection_id AS "detectionId", a.rule_id AS "ruleId",
      c.id AS "cameraId", c.name AS "cameraName", c.external_id AS "cameraExternalId",
      c.location_description AS "cameraLocation",
      city.id AS "cityId", city.name AS "cityName",
      d.id AS "departmentId", d.name AS "departmentName", d.code AS "departmentCode",
      u_ack.display_name AS "acknowledgedByName",
      u_res.display_name AS "resolvedByName"
     FROM alerts a
     JOIN cameras c ON c.id = a.camera_id
     JOIN cities city ON city.id = a.city_id
     JOIN departments d ON d.id = a.department_id
     LEFT JOIN users u_ack ON u_ack.id = a.acknowledged_by
     LEFT JOIN users u_res ON u_res.id = a.resolved_by
     WHERE a.id = $1 AND ${authFilter}`,
    values
  );
  return result.rows[0];
}

export async function acknowledgeAlert(id, userId) {
  const result = await database().query(
    `UPDATE alerts
     SET status = 'ACKNOWLEDGED',
         acknowledged_by = $2,
         acknowledged_at = now()
     WHERE id = $1 AND status = 'NEW'
     RETURNING id, status, acknowledged_at AS "acknowledgedAt"`,
    [id, userId]
  );
  return result.rows[0];
}

export async function resolveAlert(id, userId, resolutionNotes = '') {
  const result = await database().query(
    `UPDATE alerts
     SET status = 'RESOLVED',
         resolved_by = $2,
         resolved_at = now(),
         resolution_notes = $3
     WHERE id = $1 AND status IN ('NEW', 'ACKNOWLEDGED')
     RETURNING id, status, resolved_at AS "resolvedAt"`,
    [id, userId, resolutionNotes]
  );
  return result.rows[0];
}

export async function createAlert({ ruleId, detectionId, cameraId, cityId, departmentId, severity = 'MEDIUM', title, description, metadata = {} }) {
  const result = await database().query(
    `INSERT INTO alerts (rule_id, detection_id, camera_id, city_id, department_id, severity, title, description, metadata)
     VALUES ($1, $2, $3, $4, $5, $6::severity_level, $7, $8, $9)
     RETURNING id, severity, title, status, created_at AS "createdAt"`,
    [ruleId || null, detectionId || null, cameraId, cityId, departmentId, severity, title, description, JSON.stringify(metadata)]
  );
  return result.rows[0];
}

export async function listAlertRules(user) {
  const values = [];
  const filters = ['ar.active = true'];

  if (!user.roles.includes('STATE_ADMIN')) {
    values.push(user.departmentId);
    filters.push(`(ar.scope = 'GLOBAL' OR ar.department_id = $${values.length})`);
  }

  const where = filters.join(' AND ');
  const result = await database().query(
    `SELECT ar.id, ar.name, ar.scope, ar.conditions, ar.severity, ar.created_at AS "createdAt",
      d.name AS "departmentName", u.display_name AS "createdByName"
     FROM alert_rules ar
     LEFT JOIN departments d ON d.id = ar.department_id
     LEFT JOIN users u ON u.id = ar.created_by
     WHERE ${where}
     ORDER BY ar.created_at DESC`,
    values
  );
  return result.rows;
}

export async function createAlertRule({ name, departmentId, scope = 'DEPARTMENT', conditions = {}, severity = 'MEDIUM', userId }) {
  const result = await database().query(
    `INSERT INTO alert_rules (name, department_id, scope, conditions, severity, created_by)
     VALUES ($1, $2, $3::watchlist_scope, $4, $5::severity_level, $6)
     RETURNING id, name, scope, severity, created_at AS "createdAt"`,
    [name, scope === 'GLOBAL' ? null : departmentId, scope, JSON.stringify(conditions), severity, userId]
  );
  return result.rows[0];
}
