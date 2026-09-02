import { completeReport, failReport } from '../repositories/report.repository.js';
import { database } from '../repositories/database.js';

export async function processReportAsync(reportId, reportType, format, parameters = {}) {
  try {
    let data = [];
    let content = '';

    if (reportType === 'CAMERA_HEALTH') {
      const result = await database().query(
        `SELECT c.external_id, c.name, d.name AS department, city.name AS city,
          c.status, c.ai_state, c.last_seen_at, c.reconnect_attempts
         FROM cameras c
         JOIN departments d ON d.id = c.managing_department_id
         JOIN cities city ON city.id = c.city_id
         WHERE c.active = true
         ORDER BY city.name, c.name`
      );
      data = result.rows;
    } else if (reportType === 'DETECTION_ANPR') {
      const result = await database().query(
        `SELECT det.plate_number, det.vehicle_type, det.vehicle_color, det.confidence,
          det.detected_at, c.name AS camera_name, city.name AS city_name
         FROM detections det
         JOIN cameras c ON c.id = det.camera_id
         JOIN cities city ON city.id = det.city_id
         ORDER BY det.detected_at DESC
         LIMIT 200`
      );
      data = result.rows;
    } else if (reportType === 'ALERTS_SUMMARY') {
      const result = await database().query(
        `SELECT a.severity, a.title, a.status, a.created_at,
          c.name AS camera, city.name AS city, d.name AS department
         FROM alerts a
         JOIN cameras c ON c.id = a.camera_id
         JOIN cities city ON city.id = a.city_id
         JOIN departments d ON d.id = a.department_id
         ORDER BY a.created_at DESC
         LIMIT 200`
      );
      data = result.rows;
    } else if (reportType === 'INVESTIGATIONS_SUMMARY') {
      const result = await database().query(
        `SELECT i.case_number, i.title, i.status, i.target_value,
          d.name AS department, i.created_at, i.expires_at
         FROM investigations i
         JOIN departments d ON d.id = i.department_id
         ORDER BY i.created_at DESC`
      );
      data = result.rows;
    } else {
      // Default department activity or audit
      const result = await database().query(
        `SELECT action, entity_type, created_at, detail FROM audit_events ORDER BY created_at DESC LIMIT 100`
      );
      data = result.rows;
    }

    if (format === 'CSV') {
      if (data.length === 0) {
        content = 'No records found';
      } else {
        const headers = Object.keys(data[0]).join(',');
        const rows = data.map((row) =>
          Object.values(row)
            .map((val) => `"${String(val ?? '').replace(/"/g, '""')}"`)
            .join(',')
        );
        content = [headers, ...rows].join('\n');
      }
    } else {
      content = JSON.stringify(data, null, 2);
    }

    const downloadUrl = `/api/reports/${reportId}/download`;
    await completeReport(reportId, { content, downloadUrl });
  } catch (err) {
    console.error(`Report generation failed for report ${reportId}:`, err);
    await failReport(reportId, err.message);
  }
}
