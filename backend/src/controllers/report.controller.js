import { z } from 'zod';
import { listReports, findReportById, createReportRequest } from '../repositories/report.repository.js';
import { processReportAsync } from '../services/report-generator.service.js';
import { writeAudit } from '../repositories/audit.repository.js';
import { failure, success } from '../utils/api-response.js';

const requestReportSchema = z.object({
  title: z.string().min(3),
  reportType: z.enum(['CAMERA_HEALTH', 'DOWNTIME', 'DETECTION_ANPR', 'ALERTS_SUMMARY', 'INVESTIGATIONS_SUMMARY', 'DEPARTMENT_ACTIVITY', 'AUDIT_TRAIL']),
  parameters: z.record(z.any()).default({}),
  format: z.enum(['CSV', 'JSON', 'PDF']).default('JSON')
});

export async function getReports(req, res) {
  const limit = Math.min(Number(req.query.limit) || 25, 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  const data = await listReports(req.user, { limit, offset });
  return success(res, data);
}

export async function generateReport(req, res) {
  const parsed = requestReportSchema.safeParse(req.body);
  if (!parsed.success) {
    return failure(res, 'VALIDATION_ERROR', 'Invalid report request parameters.', 400);
  }

  const payload = parsed.data;
  const report = await createReportRequest({
    title: payload.title,
    reportType: payload.reportType,
    parameters: payload.parameters,
    format: payload.format,
    departmentId: req.user.departmentId,
    userId: req.user.id
  });

  // Asynchronous report generation background invocation
  setImmediate(() => {
    processReportAsync(report.id, payload.reportType, payload.format, payload.parameters);
  });

  await writeAudit({
    actorUserId: req.user.id,
    action: 'REPORT_REQUESTED',
    entityType: 'REPORT',
    entityId: report.id,
    requestId: req.id,
    detail: { title: payload.title, reportType: payload.reportType, format: payload.format }
  });

  return success(res, report, 'Report generation job queued.', 202);
}

export async function downloadReport(req, res) {
  const report = await findReportById(req.user, req.params.id);
  if (!report) return failure(res, 'NOT_FOUND', 'Report not found.', 404);

  if (report.status !== 'COMPLETED') {
    return failure(res, 'REPORT_NOT_READY', `Report is currently in status: ${report.status}`, 409);
  }

  if (report.format === 'CSV') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${report.title.replace(/\s+/g, '_')}.csv"`);
    return res.send(report.content);
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${report.title.replace(/\s+/g, '_')}.json"`);
  return res.send(report.content);
}
