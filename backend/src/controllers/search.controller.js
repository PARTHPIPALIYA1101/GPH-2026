import { searchDetections } from '../repositories/search.repository.js';
import { writeAudit } from '../repositories/audit.repository.js';
import { success } from '../utils/api-response.js';

export async function search(req, res) {
  const {
    plateNumber,
    vehicleType,
    vehicleColor,
    detectionType,
    cameraId,
    cityId,
    departmentId,
    dateFrom,
    dateTo,
    minConfidence
  } = req.query;

  const limit = Math.min(Number(req.query.limit) || 25, 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  const results = await searchDetections(req.user, {
    plateNumber,
    vehicleType,
    vehicleColor,
    detectionType,
    cameraId,
    cityId,
    departmentId,
    dateFrom,
    dateTo,
    minConfidence: minConfidence ? Number(minConfidence) : 0.5,
    limit,
    offset
  });

  // Audit search queries containing plates or target values
  if (plateNumber || vehicleType) {
    await writeAudit({
      actorUserId: req.user.id,
      action: 'DETECTION_SEARCH',
      entityType: 'SEARCH_QUERY',
      requestId: req.id,
      detail: { plateNumber, vehicleType, cityId, resultsCount: results.total }
    });
  }

  return success(res, results);
}
