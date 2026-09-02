import { database } from './database.js';

export async function createAiJob({ cameraId, externalJobId, profile = 'standard_surveillance', priority = 'normal' }) {
  const result = await database().query(
    `INSERT INTO ai_jobs (camera_id, external_job_id, status, profile, priority)
     VALUES ($1, $2, 'RUNNING', $3, $4)
     RETURNING id, camera_id AS "cameraId", external_job_id AS "externalJobId", status, profile, started_at AS "startedAt"`,
    [cameraId, externalJobId, profile, priority]
  );
  return result.rows[0];
}

export async function updateAiJobStatus(jobId, status, { latencyMs, error } = {}) {
  const result = await database().query(
    `UPDATE ai_jobs
     SET status = $2::ai_job_status,
         last_latency_ms = COALESCE($3, last_latency_ms),
         last_error = COALESCE($4, last_error),
         stopped_at = CASE WHEN $2::ai_job_status IN ('STOPPED', 'ERROR') THEN now() ELSE stopped_at END,
         updated_at = now()
     WHERE id = $1
     RETURNING id, status, last_latency_ms AS "lastLatencyMs", last_error AS "lastError"`,
    [jobId, status, latencyMs, error]
  );
  return result.rows[0];
}

export async function getAiJobByCameraId(cameraId) {
  const result = await database().query(
    `SELECT id, camera_id AS "cameraId", external_job_id AS "externalJobId", status,
      profile, priority, last_latency_ms AS "lastLatencyMs", last_error AS "lastError",
      started_at AS "startedAt", stopped_at AS "stoppedAt"
     FROM ai_jobs
     WHERE camera_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [cameraId]
  );
  return result.rows[0];
}

export async function listAiJobs({ status, limit = 25, offset = 0 }) {
  const values = [];
  const filters = [];
  if (status) {
    values.push(status);
    filters.push(`j.status = $${values.length}::ai_job_status`);
  }
  const where = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
  const listValues = [...values, limit, offset];
  const limitParam = values.length + 1;
  const offsetParam = values.length + 2;

  const [items, count] = await Promise.all([
    database().query(
      `SELECT j.id, j.status, j.profile, j.priority, j.last_latency_ms AS "lastLatencyMs",
        j.started_at AS "startedAt", c.id AS "cameraId", c.external_id AS "cameraExternalId",
        c.name AS "cameraName", city.name AS "cityName", d.name AS "departmentName"
       FROM ai_jobs j
       JOIN cameras c ON c.id = j.camera_id
       JOIN cities city ON city.id = c.city_id
       JOIN departments d ON d.id = c.managing_department_id
       ${where}
       ORDER BY j.created_at DESC
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
      listValues
    ),
    database().query(`SELECT count(*) FROM ai_jobs j ${where}`, values)
  ]);

  return { items: items.rows, total: Number(count.rows[0]?.count || 0) };
}
