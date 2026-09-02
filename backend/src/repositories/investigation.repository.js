import { database } from './database.js';

export async function listInvestigations(user, { status, limit = 25, offset = 0 }) {
  const values = [];
  const filters = [];

  if (!user.roles.includes('STATE_ADMIN')) {
    values.push(user.departmentId);
    filters.push(`i.department_id = $${values.length}`);
  }

  if (status) {
    values.push(status);
    filters.push(`i.status = $${values.length}::investigation_status`);
  }

  const where = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
  const listValues = [...values, limit, offset];
  const limitParam = values.length + 1;
  const offsetParam = values.length + 2;

  const [items, count] = await Promise.all([
    database().query(
      `SELECT i.id, i.case_number AS "caseNumber", i.title, i.description,
        i.status, i.target_type AS "targetType", i.target_value AS "targetValue",
        i.created_at AS "createdAt", i.expires_at AS "expiresAt",
        d.name AS "departmentName", d.code AS "departmentCode",
        u_creator.display_name AS "createdByName",
        u_lead.display_name AS "leadInvestigatorName",
        count(DISTINCT ir.detection_id) AS "matchCount",
        count(DISTINCT ev.id) AS "evidenceCount"
       FROM investigations i
       JOIN departments d ON d.id = i.department_id
       JOIN users u_creator ON u_creator.id = i.created_by
       LEFT JOIN users u_lead ON u_lead.id = i.lead_investigator_id
       LEFT JOIN investigation_results ir ON ir.investigation_id = i.id
       LEFT JOIN evidence ev ON ev.case_id = i.id
       ${where}
       GROUP BY i.id, d.name, d.code, u_creator.display_name, u_lead.display_name
       ORDER BY i.created_at DESC
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
      listValues
    ),
    database().query(`SELECT count(*) FROM investigations i ${where}`, values)
  ]);

  return { items: items.rows, total: Number(count.rows[0]?.count || 0) };
}

export async function findInvestigationById(user, id) {
  const values = [id];
  let authClause = '';

  if (!user.roles.includes('STATE_ADMIN')) {
    values.push(user.departmentId);
    authClause = `AND i.department_id = $2`;
  }

  const invResult = await database().query(
    `SELECT i.id, i.case_number AS "caseNumber", i.title, i.description,
      i.status, i.target_type AS "targetType", i.target_value AS "targetValue",
      i.search_criteria AS "searchCriteria", i.decision_notes AS "decisionNotes",
      i.decided_at AS "decidedAt", i.created_at AS "createdAt", i.expires_at AS "expiresAt",
      d.name AS "departmentName", d.code AS "departmentCode",
      u_creator.display_name AS "createdByName",
      u_lead.display_name AS "leadInvestigatorName",
      u_dec.display_name AS "decidedByName"
     FROM investigations i
     JOIN departments d ON d.id = i.department_id
     JOIN users u_creator ON u_creator.id = i.created_by
     LEFT JOIN users u_lead ON u_lead.id = i.lead_investigator_id
     LEFT JOIN users u_dec ON u_dec.id = i.decided_by
     WHERE i.id = $1 ${authClause}`,
    values
  );

  const inv = invResult.rows[0];
  if (!inv) return null;

  const [schedules, matches, evidence] = await Promise.all([
    database().query(
      `SELECT id, interval_minutes AS "intervalMinutes", cron_expression AS "cronExpression",
        last_run_at AS "lastRunAt", next_run_at AS "nextRunAt", active
       FROM investigation_schedules WHERE investigation_id = $1`,
      [id]
    ),
    database().query(
      `SELECT ir.id, ir.relevance_score AS "relevanceScore", ir.notes, ir.attached_at AS "attachedAt",
        det.id AS "detectionId", det.plate_number AS "plateNumber", det.vehicle_type AS "vehicleType",
        det.vehicle_color AS "vehicleColor", det.detected_at AS "detectedAt", det.confidence,
        c.name AS "cameraName", city.name AS "cityName"
       FROM investigation_results ir
       JOIN detections det ON det.id = ir.detection_id
       JOIN cameras c ON c.id = det.camera_id
       JOIN cities city ON city.id = det.city_id
       WHERE ir.investigation_id = $1
       ORDER BY det.detected_at DESC`,
      [id]
    ),
    database().query(
      `SELECT id, evidence_type AS "evidenceType", source_type AS "sourceType",
        title, storage_reference AS "storageReference", hash_sha256 AS "hashSha256",
        created_at AS "createdAt"
       FROM evidence WHERE case_id = $1
       ORDER BY created_at DESC`,
      [id]
    )
  ]);

  inv.schedules = schedules.rows;
  inv.matches = matches.rows;
  inv.evidence = evidence.rows;

  return inv;
}

export async function createInvestigation({
  title,
  description,
  departmentId,
  userId,
  leadInvestigatorId,
  targetType = 'PLATE',
  targetValue,
  searchCriteria = {},
  intervalMinutes = 360,
  expiresAt
}) {
  const caseNumber = `INV-${new Date().getFullYear()}-GJ-${Math.floor(1000 + Math.random() * 9000)}`;
  const client = await database().connect();

  try {
    let targetDeptId = departmentId;
    if (!targetDeptId) {
      const deptRes = await client.query(
        `SELECT id FROM departments WHERE code = 'POLICE' UNION ALL SELECT id FROM departments LIMIT 1`
      );
      targetDeptId = deptRes.rows[0]?.id;
    }

    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO investigations (
        case_number, title, description, department_id, created_by,
        lead_investigator_id, status, target_type, target_value, search_criteria, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'OPEN', $7, $8, $9, $10)
      RETURNING id, case_number AS "caseNumber", title, status, created_at AS "createdAt"`,
      [
        caseNumber, title, description, targetDeptId, userId,
        leadInvestigatorId || userId, targetType, targetValue.toUpperCase(),
        JSON.stringify(searchCriteria), expiresAt || null
      ]
    );
    const inv = result.rows[0];

    await client.query(
      `INSERT INTO investigation_schedules (investigation_id, interval_minutes, next_run_at)
       VALUES ($1, $2, now() + make_interval(mins => $3))`,
      [inv.id, intervalMinutes, intervalMinutes]
    );

    await client.query('COMMIT');
    return inv;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function decideInvestigation(id, { status, decisionNotes, userId }) {
  const result = await database().query(
    `UPDATE investigations
     SET status = $2::investigation_status,
         decision_notes = $3,
         decided_by = $4,
         decided_at = now(),
         updated_at = now()
     WHERE id = $1
     RETURNING id, case_number AS "caseNumber", status, decided_at AS "decidedAt"`,
    [id, status, decisionNotes, userId]
  );
  return result.rows[0];
}

export async function attachDetectionToInvestigation(investigationId, detectionId, notes = '', relevanceScore = 1.0) {
  const result = await database().query(
    `INSERT INTO investigation_results (investigation_id, detection_id, notes, relevance_score)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (investigation_id, detection_id) DO UPDATE SET notes = EXCLUDED.notes
     RETURNING id, attached_at AS "attachedAt"`,
    [investigationId, detectionId, notes, relevanceScore]
  );
  await database().query(
    `UPDATE investigations SET status = 'MATCH_FOUND', updated_at = now()
     WHERE id = $1 AND status IN ('OPEN', 'IN_PROGRESS')`,
    [investigationId]
  );
  return result.rows[0];
}
