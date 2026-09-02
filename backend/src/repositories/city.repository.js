import { database } from './database.js';

export async function listCities() {
  const result = await database().query(
    `SELECT c.id, c.name, c.district, c.state_code AS "stateCode", c.active,
      (SELECT count(*) FROM cameras cam WHERE cam.city_id = c.id AND cam.active = true) AS "cameraCount"
    FROM cities c
    ORDER BY c.name ASC`
  );
  return result.rows;
}

export async function findCityById(id) {
  const result = await database().query(
    `SELECT id, name, district, state_code AS "stateCode", active FROM cities WHERE id = $1`,
    [id]
  );
  return result.rows[0];
}

export async function createCity({ name, district, stateCode = 'GJ' }) {
  const result = await database().query(
    `INSERT INTO cities (name, district, state_code) VALUES ($1, $2, $3)
     RETURNING id, name, district, state_code AS "stateCode", active`,
    [name, district, stateCode]
  );
  return result.rows[0];
}
