import crypto from 'crypto';
import { database } from './database.js';

export async function listEvidence(user, { caseId, cameraId, limit = 25, offset = 0 }) {
  const values = [];
  const filters = [];

  if (caseId) {
    values.push(caseId);
    filters.push(`ev.case_id = $${values.length}`);
  }
  if (cameraId) {
    values.push(cameraId);
    filters.push(`ev.camera_id = $${values.length}`);
  }

  const where = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
  const listValues = [...values, limit, offset];
  const limitParam = values.length + 1;
  const offsetParam = values.length + 2;

  const [items, count] = await Promise.all([
    database().query(
      `SELECT ev.id, ev.title, ev.evidence_type AS "evidenceType", ev.source_type AS "sourceType",
        ev.storage_reference AS "storageReference", ev.hash_sha256 AS "hashSha256",
        ev.metadata, ev.exported_at AS "exportedAt", ev.created_at AS "createdAt",
        ev.case_id AS "caseId", inv.case_number AS "caseNumber",
        c.name AS "cameraName", u.display_name AS "exportedByName"
       FROM evidence ev
       LEFT JOIN investigations inv ON inv.id = ev.case_id
       LEFT JOIN cameras c ON c.id = ev.camera_id
       JOIN users u ON u.id = ev.exported_by
       ${where}
       ORDER BY ev.created_at DESC
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
      listValues
    ),
    database().query(`SELECT count(*) FROM evidence ev ${where}`, values)
  ]);

  return { items: items.rows, total: Number(count.rows[0]?.count || 0) };
}

export async function createEvidence({
  caseId,
  detectionId,
  cameraId,
  evidenceType = 'IMAGE_SNAPSHOT',
  sourceType = 'LIVE_SNAPSHOT',
  title,
  storageReference,
  metadata = {},
  userId
}) {
  const dataToHash = `${title}:${storageReference || ''}:${Date.now()}`;
  const hashSha256 = crypto.createHash('sha256').update(dataToHash).digest('hex');

  const result = await database().query(
    `INSERT INTO evidence (
      case_id, detection_id, camera_id, evidence_type, source_type,
      title, storage_reference, hash_sha256, metadata, exported_by
    ) VALUES ($1, $2, $3, $4::evidence_type, $5::evidence_source, $6, $7, $8, $9, $10)
    RETURNING id, title, evidence_type AS "evidenceType", source_type AS "sourceType", hash_sha256 AS "hashSha256", created_at AS "createdAt"`,
    [
      caseId || null, detectionId || null, cameraId || null,
      evidenceType, sourceType, title, storageReference || null,
      hashSha256, JSON.stringify(metadata), userId
    ]
  );
  return result.rows[0];
}
