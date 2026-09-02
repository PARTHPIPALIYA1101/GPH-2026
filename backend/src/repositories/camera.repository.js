import { database } from './database.js';

const selectFields = `
  c.id, c.external_id AS "externalId", c.camera_number AS "cameraNumber", c.name,
  d.id AS "departmentId", d.name AS "department", d.code AS "departmentCode",
  city.id AS "cityId", city.name AS city, city.district,
  c.location_description AS "location", c.status, c.ai_state AS "aiStatus",
  c.stream_protocol AS "streamProtocol", c.stream_reference AS "streamReference",
  c.last_seen_at AS "lastSeenAt", c.last_successful_connection_at AS "lastSuccessfulConnectionAt",
  c.reconnect_attempts AS "reconnectAttempts", c.metadata,
  ST_X(c.coordinates) AS longitude, ST_Y(c.coordinates) AS latitude
`;

function buildCameraAuthorizationFilter(user, values) {
  if (user.roles.includes('STATE_ADMIN')) {
    return '1=1';
  }
  values.push(user.departmentId, user.cities || []);
  const deptParam = values.length - 1;
  const citiesParam = values.length;

  return `(
    (c.managing_department_id = $${deptParam} OR EXISTS (
      SELECT 1 FROM camera_access_requests ar
      JOIN camera_access_request_cameras arc ON arc.request_id = ar.id
      WHERE arc.camera_id = c.id
        AND ar.requesting_department_id = $${deptParam}
        AND ar.status = 'APPROVED'
        AND (ar.expires_at IS NULL OR ar.expires_at > now())
    ))
    AND city.name = ANY($${citiesParam})
  )`;
}

export async function listAuthorizedCameras(user, { limit = 25, offset = 0, city, departmentId, status, aiStatus, search }) {
  const values = [];
  const filters = ['c.active = true'];

  filters.push(buildCameraAuthorizationFilter(user, values));

  if (city) {
    values.push(city);
    filters.push(`city.name = $${values.length}`);
  }
  if (departmentId) {
    values.push(departmentId);
    filters.push(`c.managing_department_id = $${values.length}`);
  }
  if (status) {
    values.push(status);
    filters.push(`c.status = $${values.length}::camera_status`);
  }
  if (aiStatus) {
    values.push(aiStatus);
    filters.push(`c.ai_state = $${values.length}::ai_status`);
  }
  if (search) {
    values.push(`%${search}%`);
    filters.push(`(c.name ILIKE $${values.length} OR c.external_id ILIKE $${values.length} OR c.location_description ILIKE $${values.length})`);
  }

  const where = filters.join(' AND ');
  const listValues = [...values, limit, offset];
  const limitParam = values.length + 1;
  const offsetParam = values.length + 2;

  const [items, count] = await Promise.all([
    database().query(
      `SELECT ${selectFields}
       FROM cameras c
       JOIN departments d ON d.id = c.managing_department_id
       JOIN cities city ON city.id = c.city_id
       WHERE ${where}
       ORDER BY c.created_at DESC
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
      listValues
    ),
    database().query(
      `SELECT count(*) FROM cameras c
       JOIN departments d ON d.id = c.managing_department_id
       JOIN cities city ON city.id = c.city_id
       WHERE ${where}`,
      values
    )
  ]);

  return { items: items.rows, total: Number(count.rows[0]?.count || 0) };
}

export async function findCameraById(user, id) {
  const values = [id];
  const authFilter = buildCameraAuthorizationFilter(user, values);

  const result = await database().query(
    `SELECT ${selectFields}
     FROM cameras c
     JOIN departments d ON d.id = c.managing_department_id
     JOIN cities city ON city.id = c.city_id
     WHERE c.id = $1 AND c.active = true AND ${authFilter}`,
    values
  );
  return result.rows[0];
}

export async function findCameraByIdUnrestricted(id) {
  const result = await database().query(
    `SELECT ${selectFields}
     FROM cameras c
     JOIN departments d ON d.id = c.managing_department_id
     JOIN cities city ON city.id = c.city_id
     WHERE c.id = $1 AND c.active = true`,
    [id]
  );
  return result.rows[0];
}


export async function createCamera({ externalId, cameraNumber, name, departmentId, cityId, location, streamProtocol, streamReference, latitude, longitude, metadata = {} }) {
  if (!departmentId) {
    const deptRes = await database().query(`SELECT id FROM departments ORDER BY created_at ASC LIMIT 1`);
    if (deptRes.rows[0]) departmentId = deptRes.rows[0].id;
  }

  const result = await database().query(

    `INSERT INTO cameras (
      external_id, camera_number, name, managing_department_id, city_id,
      location_description, stream_protocol, stream_reference, coordinates,
      metadata, status, ai_state
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8,
      CASE WHEN $9::float IS NULL OR $10::float IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint($10, $9), 4326) END,
      $11, 'CONNECTING', 'NOT_CONFIGURED'
    )
    RETURNING id, external_id AS "externalId", status, ai_state AS "aiStatus"`,
    [externalId, cameraNumber, name, departmentId, cityId, location, streamProtocol, streamReference, latitude, longitude, JSON.stringify(metadata)]
  );
  return result.rows[0];
}

export async function updateCamera(id, { name, location, streamProtocol, streamReference, latitude, longitude, metadata }) {
  const result = await database().query(
    `UPDATE cameras SET
      name = COALESCE($2, name),
      location_description = COALESCE($3, location_description),
      stream_protocol = COALESCE($4, stream_protocol),
      stream_reference = COALESCE($5, stream_reference),
      coordinates = CASE WHEN $6::float IS NULL OR $7::float IS NULL THEN coordinates ELSE ST_SetSRID(ST_MakePoint($7, $6), 4326) END,
      metadata = COALESCE($8, metadata),
      updated_at = now()
    WHERE id = $1 AND active = true
    RETURNING id, name, status`,
    [id, name, location, streamProtocol, streamReference, latitude, longitude, metadata ? JSON.stringify(metadata) : null]
  );
  return result.rows[0];
}

export async function updateCameraHealth(id, { status, aiState, lastSeenAt, reconnectAttempts }) {
  const result = await database().query(
    `UPDATE cameras SET
      status = COALESCE($2::camera_status, status),
      ai_state = COALESCE($3::ai_status, ai_state),
      last_seen_at = COALESCE($4, last_seen_at),
      last_successful_connection_at = CASE WHEN $2::camera_status = 'ACTIVE' THEN now() ELSE last_successful_connection_at END,
      reconnect_attempts = COALESCE($5, reconnect_attempts),
      updated_at = now()
    WHERE id = $1
    RETURNING id, status, ai_state AS "aiStatus"`,
    [id, status, aiState, lastSeenAt, reconnectAttempts]
  );
  return result.rows[0];
}

export async function getCameraOperationalSummary(user) {
  const values = [];
  const authFilter = buildCameraAuthorizationFilter(user, values);

  const result = await database().query(
    `SELECT
      count(*) AS "totalCameras",
      count(*) FILTER (WHERE c.status = 'ACTIVE') AS "onlineCount",
      count(*) FILTER (WHERE c.status = 'OFFLINE') AS "offlineCount",
      count(*) FILTER (WHERE c.status = 'DEGRADED') AS "degradedCount",
      count(*) FILTER (WHERE c.status = 'CONNECTING') AS "connectingCount",
      count(*) FILTER (WHERE c.ai_state = 'PROCESSING') AS "aiProcessingCount",
      count(*) FILTER (WHERE c.ai_state = 'ERROR' OR c.ai_state = 'DELAYED') AS "aiErrorCount",
      count(*) FILTER (WHERE c.ai_state = 'NOT_CONFIGURED') AS "aiNotConfiguredCount"
    FROM cameras c
    JOIN departments d ON d.id = c.managing_department_id
    JOIN cities city ON city.id = c.city_id
    WHERE c.active = true AND ${authFilter}`,
    values
  );

  return result.rows[0];
}

export async function mapClusters(user, { zoom = 7, city, status, departmentId }) {
  const { items } = await listAuthorizedCameras(user, { limit: 2000, offset: 0, city, status, departmentId });
  const cell = zoom < 8 ? 0.35 : zoom < 11 ? 0.10 : 0.02;
  const clusters = new Map();

  for (const camera of items.filter((item) => item.latitude !== null && item.longitude !== null)) {
    const key = `${Math.floor(camera.latitude / cell)}:${Math.floor(camera.longitude / cell)}`;
    const existing = clusters.get(key) || {
      id: key,
      latitude: 0,
      longitude: 0,
      count: 0,
      statuses: {},
      aiStatuses: {},
      cameras: []
    };

    existing.latitude += Number(camera.latitude);
    existing.longitude += Number(camera.longitude);
    existing.count += 1;
    existing.statuses[camera.status] = (existing.statuses[camera.status] || 0) + 1;
    existing.aiStatuses[camera.aiStatus] = (existing.aiStatuses[camera.aiStatus] || 0) + 1;

    if (existing.cameras.length < 25) {
      existing.cameras.push({
        id: camera.id,
        externalId: camera.externalId,
        name: camera.name,
        city: camera.city,
        department: camera.department,
        status: camera.status,
        aiStatus: camera.aiStatus,
        location: camera.location,
        latitude: camera.latitude,
        longitude: camera.longitude
      });
    }

    clusters.set(key, existing);
  }

  return [...clusters.values()].map((cluster) => ({
    ...cluster,
    latitude: cluster.latitude / cluster.count,
    longitude: cluster.longitude / cluster.count
  }));
}

export async function deleteCamera(id) {
  const result = await database().query(
    `UPDATE cameras SET active = false, updated_at = now() WHERE id = $1 RETURNING id, external_id AS "externalId"`,
    [id]
  );
  return result.rows[0];
}

