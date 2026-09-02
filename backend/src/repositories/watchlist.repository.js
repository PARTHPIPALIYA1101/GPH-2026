import { database } from './database.js';

export async function listWatchlists(user) {
  const values = [];
  const filters = ['w.active = true'];

  if (!user.roles.includes('STATE_ADMIN')) {
    values.push(user.departmentId);
    filters.push(`(w.scope = 'GLOBAL' OR w.department_id = $${values.length})`);
  }

  const where = filters.join(' AND ');
  const result = await database().query(
    `SELECT w.id, w.name, w.entity_type AS "entityType", w.scope,
      w.department_id AS "departmentId", d.name AS "departmentName",
      w.description, w.created_at AS "createdAt",
      u.display_name AS "createdByName",
      count(wi.id) AS "itemCount"
     FROM watchlists w
     LEFT JOIN departments d ON d.id = w.department_id
     LEFT JOIN users u ON u.id = w.created_by
     LEFT JOIN watchlist_items wi ON wi.watchlist_id = w.id AND wi.active = true
     WHERE ${where}
     GROUP BY w.id, d.name, u.display_name
     ORDER BY w.created_at DESC`,
    values
  );
  return result.rows;
}

export async function findWatchlistById(user, id) {
  const values = [id];
  let authClause = '';

  if (!user.roles.includes('STATE_ADMIN')) {
    values.push(user.departmentId);
    authClause = `AND (w.scope = 'GLOBAL' OR w.department_id = $2)`;
  }

  const wlResult = await database().query(
    `SELECT w.id, w.name, w.entity_type AS "entityType", w.scope,
      w.department_id AS "departmentId", d.name AS "departmentName",
      w.description, w.created_at AS "createdAt",
      u.display_name AS "createdByName"
     FROM watchlists w
     LEFT JOIN departments d ON d.id = w.department_id
     LEFT JOIN users u ON u.id = w.created_by
     WHERE w.id = $1 AND w.active = true ${authClause}`,
    values
  );

  const watchlist = wlResult.rows[0];
  if (!watchlist) return null;

  const itemsResult = await database().query(
    `SELECT id, value, description, severity, active, created_at AS "createdAt"
     FROM watchlist_items
     WHERE watchlist_id = $1 AND active = true
     ORDER BY created_at DESC`,
    [id]
  );

  watchlist.items = itemsResult.rows;
  return watchlist;
}

export async function createWatchlist({ name, entityType, scope = 'DEPARTMENT', departmentId, description, userId }) {
  const result = await database().query(
    `INSERT INTO watchlists (name, entity_type, scope, department_id, description, created_by)
     VALUES ($1, $2::watchlist_entity_type, $3::watchlist_scope, $4, $5, $6)
     RETURNING id, name, entity_type AS "entityType", scope, created_at AS "createdAt"`,
    [name, entityType, scope, scope === 'GLOBAL' ? null : departmentId, description, userId]
  );
  return result.rows[0];
}

export async function addWatchlistItem({ watchlistId, value, description, severity = 'MEDIUM' }) {
  const result = await database().query(
    `INSERT INTO watchlist_items (watchlist_id, value, description, severity)
     VALUES ($1, $2, $3, $4::severity_level)
     RETURNING id, value, description, severity, created_at AS "createdAt"`,
    [watchlistId, value.trim().toUpperCase(), description, severity]
  );
  return result.rows[0];
}

export async function removeWatchlistItem(itemId) {
  await database().query(`UPDATE watchlist_items SET active = false WHERE id = $1`, [itemId]);
}

export async function findMatchingWatchlistItems(value) {
  if (!value) return [];
  const result = await database().query(
    `SELECT wi.id AS "itemId", wi.value, wi.severity, wi.description AS "itemDescription",
      w.id AS "watchlistId", w.name AS "watchlistName", w.scope, w.department_id AS "departmentId"
     FROM watchlist_items wi
     JOIN watchlists w ON w.id = wi.watchlist_id
     WHERE wi.active = true AND w.active = true AND wi.value = $1`,
    [value.trim().toUpperCase()]
  );
  return result.rows;
}
