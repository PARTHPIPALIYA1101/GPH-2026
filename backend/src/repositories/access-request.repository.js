import { database } from './database.js';

export async function createAccessRequest({ departmentId, userId, cameraIds, duration, reason, expiresAt }) {
  const client = await database().connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO camera_access_requests (requesting_department_id, requested_by, duration, reason, expires_at)
       VALUES ($1, $2, $3::access_grant_duration, $4, $5)
       RETURNING id, status, requested_at AS "requestedAt"`,
      [departmentId, userId, duration, reason, expiresAt || null]
    );
    const req = result.rows[0];

    for (const camId of cameraIds) {
      await client.query(
        `INSERT INTO camera_access_request_cameras (request_id, camera_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [req.id, camId]
      );
    }

    await client.query('COMMIT');
    return req;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function findRequest(id) {
  const result = await database().query(
    `SELECT r.id, r.requesting_department_id AS "requestingDepartmentId",
      req.name AS "requestingDepartmentName", req.code AS "requestingDepartmentCode",
      u.display_name AS "requestedByName", u.email AS "requestedByEmail",
      r.status, r.duration, r.reason, r.requested_at AS "requestedAt",
      r.decided_by AS "decidedBy", r.decided_at AS "decidedAt", r.decision_reason AS "decisionReason",
      r.expires_at AS "expiresAt", r.revoked_by AS "revokedBy", r.revoked_at AS "revokedAt",
      r.override_by AS "overrideBy", r.override_at AS "overrideAt",
      c.managing_department_id AS "ownerDepartmentId",
      owner.name AS "ownerDepartmentName", owner.code AS "ownerDepartmentCode",
      array_agg(rc.camera_id) AS "cameraIds",
      array_agg(c.name) AS "cameraNames"
    FROM camera_access_requests r
    JOIN camera_access_request_cameras rc ON rc.request_id = r.id
    JOIN cameras c ON c.id = rc.camera_id
    JOIN departments owner ON owner.id = c.managing_department_id
    JOIN departments req ON req.id = r.requesting_department_id
    JOIN users u ON u.id = r.requested_by
    WHERE r.id = $1
    GROUP BY r.id, req.name, req.code, u.display_name, u.email, c.managing_department_id, owner.name, owner.code`,
    [id]
  );
  return result.rows[0];
}

export async function listAccessRequests(user, { direction = 'all', status, limit = 25, offset = 0 }) {
  const values = [];
  const filters = [];

  if (!user.roles.includes('STATE_ADMIN')) {
    if (direction === 'incoming') {
      values.push(user.departmentId);
      filters.push(`EXISTS (
        SELECT 1 FROM camera_access_request_cameras rc
        JOIN cameras c ON c.id = rc.camera_id
        WHERE rc.request_id = r.id AND c.managing_department_id = $${values.length}
      )`);
    } else if (direction === 'outgoing') {
      values.push(user.departmentId);
      filters.push(`r.requesting_department_id = $${values.length}`);
    } else {
      values.push(user.departmentId);
      filters.push(`(r.requesting_department_id = $${values.length} OR EXISTS (
        SELECT 1 FROM camera_access_request_cameras rc
        JOIN cameras c ON c.id = rc.camera_id
        WHERE rc.request_id = r.id AND c.managing_department_id = $${values.length}
      ))`);
    }
  }

  if (status) {
    values.push(status);
    filters.push(`r.status = $${values.length}::access_request_status`);
  }

  const where = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
  const listValues = [...values, limit, offset];
  const limitParam = values.length + 1;
  const offsetParam = values.length + 2;

  const [items, count] = await Promise.all([
    database().query(
      `SELECT r.id, r.status, r.duration, r.reason, r.requested_at AS "requestedAt",
        r.expires_at AS "expiresAt", r.decided_at AS "decidedAt", r.decision_reason AS "decisionReason",
        req.name AS "requestingDepartment", req.code AS "requestingDepartmentCode",
        u.display_name AS "requesterName",
        count(rc.camera_id) AS "cameraCount"
      FROM camera_access_requests r
      JOIN departments req ON req.id = r.requesting_department_id
      JOIN users u ON u.id = r.requested_by
      JOIN camera_access_request_cameras rc ON rc.request_id = r.id
      ${where}
      GROUP BY r.id, req.name, req.code, u.display_name
      ORDER BY r.requested_at DESC
      LIMIT $${limitParam} OFFSET $${offsetParam}`,
      listValues
    ),
    database().query(`SELECT count(DISTINCT r.id) FROM camera_access_requests r ${where}`, values)
  ]);

  return { items: items.rows, total: Number(count.rows[0]?.count || 0) };
}

export async function decideRequest(id, { status, actorId, reason, override = false }) {
  const result = await database().query(
    `UPDATE camera_access_requests
     SET status = $2::access_request_status,
         decided_by = $3,
         decided_at = now(),
         decision_reason = $4,
         override_by = CASE WHEN $5 THEN $3 ELSE NULL END,
         override_at = CASE WHEN $5 THEN now() ELSE NULL END
     WHERE id = $1 AND status = 'PENDING'
     RETURNING id, status, expires_at AS "expiresAt"`,
    [id, status, actorId, reason, override]
  );
  return result.rows[0];
}

export async function revokeRequest(id, actorId) {
  const result = await database().query(
    `UPDATE camera_access_requests
     SET status = 'REVOKED',
         revoked_by = $2,
         revoked_at = now()
     WHERE id = $1 AND status = 'APPROVED'
     RETURNING id, status`,
    [id, actorId]
  );
  return result.rows[0];
}

export async function expireDueRequests() {
  return database().query(
    `UPDATE camera_access_requests
     SET status = 'EXPIRED'
     WHERE status = 'APPROVED' AND expires_at IS NOT NULL AND expires_at <= now()`
  );
}
