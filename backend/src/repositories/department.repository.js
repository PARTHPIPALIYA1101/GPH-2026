import { database } from './database.js';

export async function listDepartments() {
  const result = await database().query(
    `SELECT d.id, d.code, d.name, d.category, d.active, d.created_at AS "createdAt",
      (SELECT count(*) FROM users u WHERE u.department_id = d.id AND u.status = 'ACTIVE') AS "activeUserCount",
      (SELECT count(*) FROM cameras c WHERE c.managing_department_id = d.id AND c.active = true) AS "cameraCount"
    FROM departments d
    ORDER BY d.name ASC`
  );
  return result.rows;
}

export async function findDepartmentById(id) {
  const result = await database().query(
    `SELECT id, code, name, category, active, created_at AS "createdAt" FROM departments WHERE id = $1`,
    [id]
  );
  return result.rows[0];
}

export async function createDepartment({ code, name, category }) {
  const result = await database().query(
    `INSERT INTO departments (code, name, category) VALUES ($1, $2, $3)
     RETURNING id, code, name, category, active, created_at AS "createdAt"`,
    [code.toUpperCase(), name, category]
  );
  return result.rows[0];
}
