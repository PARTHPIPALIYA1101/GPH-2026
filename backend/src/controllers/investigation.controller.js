import { z } from 'zod';
import {
  listInvestigations,
  findInvestigationById,
  createInvestigation,
  decideInvestigation,
  attachDetectionToInvestigation
} from '../repositories/investigation.repository.js';
import { writeAudit } from '../repositories/audit.repository.js';
import { failure, success } from '../utils/api-response.js';

const createInvestigationSchema = z.object({
  title: z.string().min(5),
  description: z.string().min(10),
  targetType: z.string().default('PLATE'),
  targetValue: z.string().min(2),
  searchCriteria: z.record(z.any()).default({}),
  intervalMinutes: z.coerce.number().min(15).max(1440).default(360),
  expiresAt: z.string().datetime().optional().nullable(),
  leadInvestigatorId: z.string().uuid().optional()
});

const decisionSchema = z.object({
  status: z.enum(['RESOLVED', 'CLOSED', 'UNDER_REVIEW', 'MATCH_FOUND']),
  decisionNotes: z.string().min(5).max(2000)
});

const attachSchema = z.object({
  detectionId: z.string().uuid(),
  notes: z.string().optional(),
  relevanceScore: z.coerce.number().min(0).max(1).default(1.0)
});

export async function getInvestigations(req, res) {
  const limit = Math.min(Number(req.query.limit) || 25, 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const status = req.query.status;

  const data = await listInvestigations(req.user, { status, limit, offset });
  return success(res, data);
}

export async function getInvestigation(req, res) {
  const inv = await findInvestigationById(req.user, req.params.id);
  if (!inv) {
    return failure(res, 'INVESTIGATION_NOT_FOUND', 'Investigation not found or unauthorized.', 404);
  }
  return success(res, inv);
}

export async function createNewInvestigation(req, res) {
  const isOfficer = req.user.roles.includes('OFFICER');
  const isInvestigator = req.user.roles.includes('INVESTIGATOR');
  const isDeptHead = req.user.roles.includes('DEPARTMENT_HEAD');
  const isStateAdmin = req.user.roles.includes('STATE_ADMIN');

  if (!isOfficer && !isInvestigator && !isDeptHead && !isStateAdmin) {
    return failure(res, 'AUTHORIZATION_DENIED', 'You do not have permission to open investigations.', 403);
  }

  const parsed = createInvestigationSchema.safeParse(req.body);
  if (!parsed.success) {
    return failure(res, 'VALIDATION_ERROR', 'Invalid investigation parameters.', 400);
  }

  const payload = parsed.data;
  const created = await createInvestigation({
    title: payload.title,
    description: payload.description,
    departmentId: req.user.departmentId,
    userId: req.user.id,
    leadInvestigatorId: payload.leadInvestigatorId || req.user.id,
    targetType: payload.targetType,
    targetValue: payload.targetValue,
    searchCriteria: payload.searchCriteria,
    intervalMinutes: payload.intervalMinutes,
    expiresAt: payload.expiresAt
  });

  await writeAudit({
    actorUserId: req.user.id,
    action: 'INVESTIGATION_CREATE',
    entityType: 'INVESTIGATION',
    entityId: created.id,
    requestId: req.id,
    detail: { caseNumber: created.caseNumber, targetValue: payload.targetValue }
  });

  return success(res, created, 'Investigation case opened.', 201);
}

export async function submitDecision(req, res) {
  const isDeptHead = req.user.roles.includes('DEPARTMENT_HEAD');
  const isStateAdmin = req.user.roles.includes('STATE_ADMIN');

  if (!isDeptHead && !isStateAdmin) {
    return failure(res, 'AUTHORIZATION_DENIED', 'Only Department Heads or State Admins have final investigation decision authority.', 403);
  }

  const inv = await findInvestigationById(req.user, req.params.id);
  if (!inv) {
    return failure(res, 'INVESTIGATION_NOT_FOUND', 'Investigation not found or unauthorized.', 404);
  }

  const parsed = decisionSchema.safeParse(req.body);
  if (!parsed.success) {
    return failure(res, 'VALIDATION_ERROR', 'Decision notes and valid status are required.', 400);
  }

  const result = await decideInvestigation(req.params.id, {
    status: parsed.data.status,
    decisionNotes: parsed.data.decisionNotes,
    userId: req.user.id
  });

  await writeAudit({
    actorUserId: req.user.id,
    action: `INVESTIGATION_${parsed.data.status}`,
    entityType: 'INVESTIGATION',
    entityId: req.params.id,
    requestId: req.id,
    detail: { status: parsed.data.status, decisionNotes: parsed.data.decisionNotes }
  });

  return success(res, result, `Investigation decision recorded: ${parsed.data.status}`);
}

export async function attachDetection(req, res) {
  const inv = await findInvestigationById(req.user, req.params.id);
  if (!inv) {
    return failure(res, 'INVESTIGATION_NOT_FOUND', 'Investigation not found or unauthorized.', 404);
  }

  const parsed = attachSchema.safeParse(req.body);
  if (!parsed.success) {
    return failure(res, 'VALIDATION_ERROR', 'Valid detectionId is required.', 400);
  }

  const result = await attachDetectionToInvestigation(
    req.params.id,
    parsed.data.detectionId,
    parsed.data.notes,
    parsed.data.relevanceScore
  );

  await writeAudit({
    actorUserId: req.user.id,
    action: 'INVESTIGATION_ATTACH_DETECTION',
    entityType: 'INVESTIGATION',
    entityId: req.params.id,
    requestId: req.id,
    detail: { detectionId: parsed.data.detectionId }
  });

  return success(res, result, 'Detection linked to investigation case.');
}
