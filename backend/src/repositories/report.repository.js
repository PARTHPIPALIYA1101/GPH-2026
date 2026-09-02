import { database } from './database.js';

export async function listReports(user, { limit = 25, offset = 0 }) {
  const values = [];
  const filters = [];

  if (!user.roles.includes('STATE_ADMIN')) {
    values.push(user.departmentId, user.id);
    filters.push(`(r.department_id = $1 OR r.created_by = $2)`);
  }

  const where = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
  const listValues = [...values, limit, offset];
  const limitParam = values.length + 1;
  const offsetParam = values.length + 2;

  const [items, count] = await Promise.all([
    database().query(
      `SELECT r.id, r.title, r.report_type AS "reportType", r.format, r.status,
        r.parameters, r.download_url AS "downloadUrl", r.created_at AS "createdAt",
        r.completed_at AS "completedAt", r.error_message AS "errorMessage",
        u.display_name AS "createdByName", d.name AS "departmentName"
       FROM reports r
       JOIN users u ON u.id = r.created_by
       LEFT JOIN departments d ON d.id = r.department_id
       ${where}
       ORDER BY r.created_at DESC
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
      listValues
    ),
    database().query(`SELECT count(*) FROM reports r ${where}`, values)
  ]);

  return { items: items.rows, total: Number(count.rows[0]?.count || 0) };
}

export async function findReportById(user, id) {
  const result = await database().query(
    `SELECT r.id, r.title, r.report_type AS "reportType", r.format, r.status,
      r.parameters, r.content, r.download_url AS "downloadUrl", r.created_at AS "createdAt",
      r.completed_at AS "completedAt", r.error_message AS "errorMessage",
      u.display_name AS "createdByName", d.name AS "departmentName"
     FROM reports r
     JOIN users u ON u.id = r.created_by
     LEFT JOIN departments d ON d.id = r.department_id
     WHERE r.id = $1`,
    [id]
  );
  return result.rows[0];
}

export async function createReportRequest({ title, reportType, parameters = {}, format = 'JSON', departmentId, userId }) {
  const result = await database().query(
    `INSERT INTO reports (title, report_type, parameters, format, status, department_id, created_by)
     VALUES ($1, $2::report_type, $3, $4::report_format, 'PROCESSING', $5, $6)
     RETURNING id, title, report_type AS "reportType", format, status, created_at AS "createdAt"`,
    [title, reportType, JSON.stringify(parameters), format, departmentId || null, userId]
  );
  return result.rows[0];
}

export async function completeReport(id, { content, downloadUrl }) {
  const result = await database().query(
    `UPDATE reports
     SET status = 'COMPLETED',
         content = $2,
         download_url = $3,
         completed_at = now()
     WHERE id = $1
     RETURNING id, status, completed_at AS "completedAt"`,
    [id, content, downloadUrl]
  );
  return result.rows[0];
}

export async function failReport(id, errorMessage) {
  await database().query(
    `UPDATE reports SET status = 'FAILED', error_message = $2, completed_at = now() WHERE id = $1`,
    [id, errorMessage]
  );
}
