'use strict';

const { query } = require('../config/database');
const { paginate, paginatedResponse } = require('../utils/pagination');

const list = async (filters) => {
  const { page, limit, skip } = paginate(filters);
  const conditions = [];
  const params = [];
  let idx = 1;

  if (filters.role) { conditions.push(`role = $${idx++}`); params.push(filters.role); }
  if (filters.search) {
    conditions.push(`(name ILIKE $${idx} OR email ILIKE $${idx})`);
    params.push(`%${filters.search}%`);
    idx++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRes = await query(`SELECT COUNT(*) FROM users ${where}`, params);
  const total = parseInt(countRes.rows[0].count, 10);

  const dataRes = await query(
    `SELECT u.id, u.name, u.email, u.picture, u.role, u.franchise_id, u.created_at, u.updated_at,
            f.name AS franchise_name
     FROM users u
     LEFT JOIN franchises f ON f.id = u.franchise_id
     ${where}
     ORDER BY u.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, skip]
  );

  return paginatedResponse(dataRes.rows, total, page, limit);
};

const getOne = async (id) => {
  const res = await query(
    `SELECT u.id, u.name, u.email, u.picture, u.role, u.franchise_id, u.created_at, u.updated_at,
            f.name AS franchise_name
     FROM users u
     LEFT JOIN franchises f ON f.id = u.franchise_id
     WHERE u.id = $1`,
    [id]
  );
  if (!res.rows[0]) { const e = new Error('User not found'); e.status = 404; throw e; }
  return res.rows[0];
};

const update = async (id, data) => {
  const allowed = ['role', 'franchise_id'];
  const fields = []; const params = []; let idx = 1;
  for (const f of allowed) {
    if (data[f] !== undefined) { fields.push(`${f} = $${idx++}`); params.push(data[f]); }
  }
  if (!fields.length) { const e = new Error('No valid fields to update (allowed: role, franchise_id)'); e.status = 400; throw e; }
  fields.push('updated_at = NOW()');
  params.push(id);
  const res = await query(`UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, params);
  if (!res.rows[0]) { const e = new Error('User not found'); e.status = 404; throw e; }
  return res.rows[0];
};

const remove = async (id) => {
  const res = await query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
  if (!res.rows[0]) { const e = new Error('User not found'); e.status = 404; throw e; }
};

module.exports = { list, getOne, update, remove };
