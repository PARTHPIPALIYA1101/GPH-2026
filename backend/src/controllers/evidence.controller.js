import { z } from 'zod';
import { listEvidence, createEvidence } from '../repositories/evidence.repository.js';
import { writeAudit } from '../repositories/audit.repository.js';
import { failure, success } from '../utils/api-response.js';

const createEvidenceSchema = z.object({
  caseId: z.string().uuid().optional(),
  detectionId: z.string().uuid().optional(),
  cameraId: z.string().uuid().optional(),
  evidenceType: z.enum(['IMAGE_SNAPSHOT', 'METADATA_JSON', 'VIDEO_CLIP', 'REPORT_DOCUMENT']).default('IMAGE_SNAPSHOT'),
  sourceType: z.enum(['LIVE_SNAPSHOT', 'RECORDED_VMS']).default('LIVE_SNAPSHOT'),
  title: z.string().min(3),
  storageReference: z.string().optional(),
  metadata: z.record(z.any()).default({})
});

export async function getEvidenceList(req, res) {
  const limit = Math.min(Number(req.query.limit) || 25, 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const caseId = req.query.caseId;
  const cameraId = req.query.cameraId;

  const data = await listEvidence(req.user, { caseId, cameraId, limit, offset });
  return success(res, data);
}

export async function saveEvidence(req, res) {
  const parsed = createEvidenceSchema.safeParse(req.body);
  if (!parsed.success) {
    return failure(res, 'VALIDATION_ERROR', 'Invalid evidence parameters.', 400);
  }

  const payload = parsed.data;
  const evidence = await createEvidence({
    caseId: payload.caseId,
    detectionId: payload.detectionId,
    cameraId: payload.cameraId,
    evidenceType: payload.evidenceType,
    sourceType: payload.sourceType,
    title: payload.title,
    storageReference: payload.storageReference || `https://storage.internal.gov.in/evidence/export_${Date.now()}.bin`,
    metadata: payload.metadata,
    userId: req.user.id
  });

  await writeAudit({
    actorUserId: req.user.id,
    action: 'EVIDENCE_EXPORT',
    entityType: 'EVIDENCE',
    entityId: evidence.id,
    requestId: req.id,
    detail: { title: payload.title, evidenceType: payload.evidenceType, hash: evidence.hashSha256 }
  });

  return success(res, evidence, 'Evidence recorded and SHA256 integrity hash generated.', 201);
}
