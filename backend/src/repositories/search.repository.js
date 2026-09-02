import { database } from './database.js';

function buildSearchAuthorizationFilter(user, values) {
  if (user.roles.includes('STATE_ADMIN')) {
    return '1=1';
  }
  values.push(user.departmentId, user.cities || []);
  const deptParam = values.length - 1;
  const citiesParam = values.length;

  return `(
    (det.department_id = $${deptParam} OR EXISTS (
      SELECT 1 FROM camera_access_requests ar
      JOIN camera_access_request_cameras arc ON arc.request_id = ar.id
      WHERE arc.camera_id = det.camera_id
        AND ar.requesting_department_id = $${deptParam}
        AND ar.status = 'APPROVED'
        AND (ar.expires_at IS NULL OR ar.expires_at > now())
    ))
    AND city.name = ANY($${citiesParam})
  )`;
}

export async function searchDetections(user, {
  plateNumber,
  vehicleType,
  vehicleColor,
  detectionType,
  cameraId,
  cityId,
  departmentId,
  dateFrom,
  dateTo,
  minConfidence = 0.5,
  limit = 25,
  offset = 0
}) {
  const values = [];
  const filters = [];

  filters.push(buildSearchAuthorizationFilter(user, values));

  if (plateNumber) {
    values.push(`%${plateNumber.trim().toUpperCase()}%`);
    filters.push(`det.plate_number ILIKE $${values.length}`);
  }
  if (vehicleType) {
    values.push(vehicleType.toUpperCase());
    filters.push(`det.vehicle_type = $${values.length}`);
  }
  if (vehicleColor) {
    values.push(vehicleColor.toUpperCase());
    filters.push(`det.vehicle_color = $${values.length}`);
  }
  if (detectionType) {
    values.push(detectionType);
    filters.push(`det.detection_type = $${values.length}::detection_type`);
  }
  if (cameraId) {
    values.push(cameraId);
    filters.push(`det.camera_id = $${values.length}`);
  }
  if (cityId) {
    values.push(cityId);
    filters.push(`det.city_id = $${values.length}`);
  }
  if (departmentId) {
    values.push(departmentId);
    filters.push(`det.department_id = $${values.length}`);
  }
  if (dateFrom) {
    values.push(dateFrom);
    filters.push(`det.detected_at >= $${values.length}`);
  }
  if (dateTo) {
    values.push(dateTo);
    filters.push(`det.detected_at <= $${values.length}`);
  }
  if (minConfidence) {
    values.push(minConfidence);
    filters.push(`det.confidence >= $${values.length}`);
  }

  const where = filters.join(' AND ');
  const listValues = [...values, limit, offset];
  const limitParam = values.length + 1;
  const offsetParam = values.length + 2;

  const [items, count] = await Promise.all([
    database().query(
      `SELECT det.id, det.detection_type AS "detectionType", det.confidence,
        det.track_id AS "trackId", det.plate_number AS "plateNumber",
        det.vehicle_type AS "vehicleType", det.vehicle_color AS "vehicleColor",
        det.attributes, det.detected_at AS "detectedAt", det.evidence_url AS "evidenceUrl",
        c.id AS "cameraId", c.name AS "cameraName", c.external_id AS "cameraExternalId",
        c.location_description AS "cameraLocation",
        city.id AS "cityId", city.name AS "cityName",
        d.id AS "departmentId", d.name AS "departmentName", d.code AS "departmentCode"
       FROM detections det
       JOIN cameras c ON c.id = det.camera_id
       JOIN cities city ON city.id = det.city_id
       JOIN departments d ON d.id = det.department_id
       WHERE ${where}
       ORDER BY det.detected_at DESC
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
      listValues
    ),
    database().query(
      `SELECT count(*)
       FROM detections det
       JOIN cameras c ON c.id = det.camera_id
       JOIN cities city ON city.id = det.city_id
       JOIN departments d ON d.id = det.department_id
       WHERE ${where}`,
      values
    )
  ]);

  return { items: items.rows, total: Number(count.rows[0]?.count || 0) };
}

export async function insertDetection({
  cameraId,
  cityId,
  departmentId,
  detectionType = 'PLATE',
  confidence = 0.9,
  trackId,
  plateNumber,
  vehicleType,
  vehicleColor,
  personAttributes = {},
  objectLabel,
  attributes = {},
  detectedAt = new Date(),
  evidenceUrl
}) {
  const result = await database().query(
    `INSERT INTO detections (
      camera_id, city_id, department_id, detection_type, confidence,
      track_id, plate_number, vehicle_type, vehicle_color,
      person_attributes, object_label, attributes, detected_at, evidence_url
    ) VALUES ($1, $2, $3, $4::detection_type, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING id, plate_number AS "plateNumber", detected_at AS "detectedAt"`,
    [
      cameraId, cityId, departmentId, detectionType, confidence,
      trackId, plateNumber ? plateNumber.toUpperCase() : null,
      vehicleType ? vehicleType.toUpperCase() : null,
      vehicleColor ? vehicleColor.toUpperCase() : null,
      JSON.stringify(personAttributes), objectLabel,
      JSON.stringify(attributes), detectedAt, evidenceUrl
    ]
  );
  return result.rows[0];
}
