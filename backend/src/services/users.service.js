'use strict';

const { query } = require('../config/database');
const { paginate, paginatedResponse } = require('../utils/pagination');
const { tenantWhere } = require('../middleware/tenantScope');

const list = async (filters, req) => {
  const { page, limit, skip } = paginate(filters);
  const conditions = [];
  const params = [];
  let idx = 1;

  const tenant = tenantWhere(req, idx);
  if (tenant.clause) { conditions.push(tenant.clause); params.push(...tenant.params); idx += tenant.params.length; }

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
    `SELECT u.id, u.name, u.email, u.picture, u.role, u.franchise_id, u.tenant_id, u.created_at, u.updated_at,
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

const getOne = async (id, req) => {
  const conditions = ['u.id = $1'];
  const params = [id];
  const tenant = tenantWhere(req, 2);
  if (tenant.clause) { conditions.push(tenant.clause.replace('tenant_id', 'u.tenant_id')); params.push(...tenant.params); }

  const res = await query(
    `SELECT u.id, u.name, u.email, u.picture, u.role, u.franchise_id, u.tenant_id, u.created_at, u.updated_at,
            f.name AS franchise_name
     FROM users u
     LEFT JOIN franchises f ON f.id = u.franchise_id
     WHERE ${conditions.join(' AND ')}`,
    params
  );
  if (!res.rows[0]) { const e = new Error('User not found'); e.status = 404; throw e; }
  return res.rows[0];
};

const update = async (id, data, req) => {
  // tenant_id is intentionally not user-editable via `data` here to avoid a
  // tenant admin moving a user into someone else's tenant; assigning a
  // user's tenant is a super-admin/platform-level action, not a CRM one.
  const allowed = ['role', 'franchise_id'];
  const fields = []; const params = []; let idx = 1;
  for (const f of allowed) {
    if (data[f] !== undefined) { fields.push(`${f} = $${idx++}`); params.push(data[f]); }
  }
  if (!fields.length) { const e = new Error('No valid fields to update (allowed: role, franchise_id)'); e.status = 400; throw e; }
  fields.push('updated_at = NOW()');
  params.push(id);
  let sql = `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx}`;
  const tenant = tenantWhere(req, idx + 1);
  if (tenant.clause) { sql += ` AND ${tenant.clause}`; params.push(...tenant.params); }
  const res = await query(`${sql} RETURNING *`, params);
  if (!res.rows[0]) { const e = new Error('User not found'); e.status = 404; throw e; }
  return res.rows[0];
};

const remove = async (id, req) => {
  let sql = 'DELETE FROM users WHERE id = $1';
  const params = [id];
  const tenant = tenantWhere(req, 2);
  if (tenant.clause) { sql += ` AND ${tenant.clause}`; params.push(...tenant.params); }
  const res = await query(`${sql} RETURNING id`, params);
  if (!res.rows[0]) { const e = new Error('User not found'); e.status = 404; throw e; }
};

module.exports = { list, getOne, update, remove };
