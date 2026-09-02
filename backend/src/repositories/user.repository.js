import { database } from './database.js';

function parsePgArray(val) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    return val
      .replace(/^\{|\}$/g, '')
      .split(',')
      .map((s) => s.trim().replace(/^"|"$/g, ''))
      .filter(Boolean);
  }
  return [];
}

export function normalizeUserRecord(user) {
  if (!user) return undefined;
  return {
    ...user,
    roles: parsePgArray(user.roles),
    cities: parsePgArray(user.cities),
    cityIds: parsePgArray(user.cityIds)
  };
}

export async function findUserByEmail(email) {
  const result = await database().query(
    `SELECT u.id, u.email, u.display_name AS "displayName", u.password_hash AS "passwordHash",
      u.status, u.administrative_scope AS "administrativeScope", u.department_id AS "departmentId",
      d.code AS "departmentCode", d.name AS "departmentName",
      COALESCE(array_agg(DISTINCT ur.role::text) FILTER (WHERE ur.role IS NOT NULL), '{}') AS roles,
      COALESCE(array_agg(DISTINCT c.name::text) FILTER (WHERE c.name IS NOT NULL), '{}') AS cities,
      COALESCE(array_agg(DISTINCT c.id::text) FILTER (WHERE c.id IS NOT NULL), '{}') AS "cityIds"
    FROM users u
    LEFT JOIN departments d ON d.id = u.department_id
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN user_city_scopes ucs ON ucs.user_id = u.id
    LEFT JOIN cities c ON c.id = ucs.city_id
    WHERE u.email = $1
    GROUP BY u.id, d.code, d.name`,
    [email]
  );
  return normalizeUserRecord(result.rows[0]);
}

export async function findUserById(id) {
  const result = await database().query(
    `SELECT u.id, u.email, u.display_name AS "displayName", u.status,
      u.administrative_scope AS "administrativeScope", u.department_id AS "departmentId",
      d.code AS "departmentCode", d.name AS "departmentName",
      COALESCE(array_agg(DISTINCT ur.role::text) FILTER (WHERE ur.role IS NOT NULL), '{}') AS roles,
      COALESCE(array_agg(DISTINCT c.name::text) FILTER (WHERE c.name IS NOT NULL), '{}') AS cities,
      COALESCE(array_agg(DISTINCT c.id::text) FILTER (WHERE c.id IS NOT NULL), '{}') AS "cityIds",
      u.created_at AS "createdAt", u.last_login_at AS "lastLoginAt"
    FROM users u
    LEFT JOIN departments d ON d.id = u.department_id
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN user_city_scopes ucs ON ucs.user_id = u.id
    LEFT JOIN cities c ON c.id = ucs.city_id
    WHERE u.id = $1
    GROUP BY u.id, d.code, d.name`,
    [id]
  );
  return normalizeUserRecord(result.rows[0]);
}

export async function listUsers({ departmentId, status, role, limit = 25, offset = 0 }) {
  const values = [];
  const filters = [];

  if (departmentId) {
    values.push(departmentId);
    filters.push(`u.department_id = $${values.length}`);
  }
  if (status) {
    values.push(status);
    filters.push(`u.status = $${values.length}`);
  }
  if (role) {
    values.push(role);
    filters.push(`EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role = $${values.length}::platform_role)`);
  }

  const where = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
  const listValues = [...values, limit, offset];
  const limitParam = values.length + 1;
  const offsetParam = values.length + 2;

  const [items, count] = await Promise.all([
    database().query(
      `SELECT u.id, u.email, u.display_name AS "displayName", u.status,
        u.administrative_scope AS "administrativeScope", u.department_id AS "departmentId",
        d.code AS "departmentCode", d.name AS "departmentName",
        COALESCE(array_agg(DISTINCT ur.role::text) FILTER (WHERE ur.role IS NOT NULL), '{}') AS roles,
        COALESCE(array_agg(DISTINCT c.name::text) FILTER (WHERE c.name IS NOT NULL), '{}') AS cities,
        COALESCE(array_agg(DISTINCT c.id::text) FILTER (WHERE c.id IS NOT NULL), '{}') AS "cityIds",
        u.created_at AS "createdAt", u.last_login_at AS "lastLoginAt"
      FROM users u
      LEFT JOIN departments d ON d.id = u.department_id
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN user_city_scopes ucs ON ucs.user_id = u.id
      LEFT JOIN cities c ON c.id = ucs.city_id
      ${where}
      GROUP BY u.id, d.code, d.name
      ORDER BY u.created_at DESC
      LIMIT $${limitParam} OFFSET $${offsetParam}`,
      listValues
    ),
    database().query(`SELECT count(DISTINCT u.id) FROM users u ${where}`, values)
  ]);

  return {
    items: items.rows.map(normalizeUserRecord),
    total: Number(count.rows[0]?.count || 0)
  };
}

export async function createUser({ departmentId, email, displayName, password, roles = [], cityIds = [], administrativeScope = {} }) {
  const client = await database().connect();
  try {
    await client.query('BEGIN');
    const userRes = await client.query(
      `INSERT INTO users (department_id, email, display_name, password_hash, administrative_scope)
       VALUES ($1, $2, $3, crypt($4, gen_salt('bf')), $5)
       RETURNING id, email, display_name AS "displayName", status, created_at AS "createdAt"`,
      [departmentId || null, email, displayName, password, JSON.stringify(administrativeScope)]
    );
    const user = userRes.rows[0];

    for (const role of roles) {
      await client.query(
        `INSERT INTO user_roles (user_id, role) VALUES ($1, $2::platform_role) ON CONFLICT DO NOTHING`,
        [user.id, role]
      );
    }

    for (const cityId of cityIds) {
      await client.query(
        `INSERT INTO user_city_scopes (user_id, city_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [user.id, cityId]
      );
    }

    await client.query('COMMIT');
    return findUserById(user.id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateUserStatus(id, status) {
  const result = await database().query(
    `UPDATE users SET status = $2::user_status,
      disabled_at = CASE WHEN $2::user_status = 'DISABLED' THEN now() ELSE NULL END,
      updated_at = now()
    WHERE id = $1
    RETURNING id, status`,
    [id, status]
  );
  return result.rows[0];
}

export async function updateLastLogin(id) {
  await database().query(`UPDATE users SET last_login_at = now() WHERE id = $1`, [id]);
}
