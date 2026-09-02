import { z } from 'zod';
import { listCities, findCityById, createCity } from '../repositories/city.repository.js';
import { writeAudit } from '../repositories/audit.repository.js';
import { failure, success } from '../utils/api-response.js';

const createCitySchema = z.object({
  name: z.string().min(2),
  district: z.string().min(2),
  stateCode: z.string().default('GJ')
});

export async function getCities(req, res) {
  const cities = await listCities();
  return success(res, cities);
}

export async function getCityById(req, res) {
  const city = await findCityById(req.params.id);
  if (!city) return failure(res, 'NOT_FOUND', 'City not found.', 404);
  return success(res, city);
}

export async function createNewCity(req, res) {
  if (!req.user.roles.includes('STATE_ADMIN')) {
    return failure(res, 'AUTHORIZATION_DENIED', 'Only State Admin can register new cities.', 403);
  }

  const parsed = createCitySchema.safeParse(req.body);
  if (!parsed.success) {
    return failure(res, 'VALIDATION_ERROR', 'Invalid city details.', 400);
  }

  try {
    const city = await createCity(parsed.data);

    await writeAudit({
      actorUserId: req.user.id,
      action: 'CITY_CREATE',
      entityType: 'CITY',
      entityId: city.id,
      requestId: req.id,
      detail: parsed.data
    });

    return success(res, city, 'City registered successfully.', 201);
  } catch (err) {
    if (err.code === '23505') {
      return failure(res, 'DUPLICATE_CITY', 'City and district combination already exists.', 409);
    }
    throw err;
  }
}
