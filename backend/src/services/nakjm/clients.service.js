'use strict';

const { query } = require('../../config/database');
const { v4: uuidv4 } = require('uuid');
const { paginate, paginatedResponse } = require('../../utils/pagination');
const { tenantWhere, tenantIdForInsert } = require('../../middleware/tenantScope');

const list = async (filters, req) => {
  const { page, limit, skip } = paginate(filters);
  const conditions = [];
  const params = [];
  let idx = 1;

  const tenant = tenantWhere(req, idx);
  if (tenant.clause) { conditions.push(tenant.clause); params.push(...tenant.params); idx += tenant.params.length; }

  if (filters.status)      { conditions.push(`status = $${idx++}`);      params.push(filters.status); }
  if (filters.client_type) { conditions.push(`client_type = $${idx++}`); params.push(filters.client_type); }
  if (filters.search)      { conditions.push(`(name ILIKE $${idx} OR contact_email ILIKE $${idx})`); params.push(`%${filters.search}%`); idx++; }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRes = await query(`SELECT COUNT(*) FROM nakjm_clients ${where}`, params);
  const total = parseInt(countRes.rows[0].count, 10);

  const dataRes = await query(
    `SELECT c.*,
      (SELECT COUNT(*) FROM nakjm_projects p WHERE p.client_id = c.id) AS project_count,
      (SELECT COALESCE(SUM(cp.amount),0) FROM nakjm_client_payments cp WHERE cp.client_id = c.id) AS total_collected
     FROM nakjm_clients c ${where}
     ORDER BY c.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, skip]
  );

  return paginatedResponse(dataRes.rows, total, page, limit);
};

const getOne = async (id, req) => {
  const conditions = ['id = $1'];
  const params = [id];
  const tenant = tenantWhere(req, 2);
  if (tenant.clause) { conditions.push(tenant.clause); params.push(...tenant.params); }
  const res = await query(`SELECT * FROM nakjm_clients WHERE ${conditions.join(' AND ')}`, params);
  if (!res.rows[0]) { const e = new Error('Client not found'); e.status = 404; throw e; }

  const projectsRes = await query(
    `SELECT id, project_code, name, status, contract_value, start_date, target_end_date
     FROM nakjm_projects WHERE client_id = $1 ORDER BY created_at DESC`,
    [id]
  );

  const paymentsRes = await query(
    `SELECT COALESCE(SUM(amount),0) AS total_collected FROM nakjm_client_payments WHERE client_id = $1`,
    [id]
  );

  return {
    ...res.rows[0],
    projects: projectsRes.rows,
    total_collected: parseFloat(paymentsRes.rows[0].total_collected),
  };
};

const create = async (data, req) => {
  const {
    name, client_type = 'private', contact_name = null, contact_email = null, contact_phone = null,
    address = null, city = null, state = null, gstin = null, status = 'active', notes = null,
  } = data;
  if (!name) { const e = new Error('name is required'); e.status = 400; throw e; }
  const id = uuidv4();
  const res = await query(
    `INSERT INTO nakjm_clients (id, tenant_id, name, client_type, contact_name, contact_email, contact_phone, address, city, state, gstin, status, notes, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),NOW()) RETURNING *`,
    [id, tenantIdForInsert(req), name, client_type, contact_name, contact_email, contact_phone, address, city, state, gstin, status, notes]
  );
  return res.rows[0];
};

const update = async (id, data, req) => {
  const allowed = ['name', 'client_type', 'contact_name', 'contact_email', 'contact_phone', 'address', 'city', 'state', 'gstin', 'status', 'notes'];
  const fields = []; const params = []; let idx = 1;
  for (const f of allowed) {
    if (data[f] !== undefined) { fields.push(`${f} = $${idx++}`); params.push(data[f]); }
  }
  if (!fields.length) { const e = new Error('No valid fields to update'); e.status = 400; throw e; }
  fields.push('updated_at = NOW()');
  params.push(id);
  let sql = `UPDATE nakjm_clients SET ${fields.join(', ')} WHERE id = $${idx}`;
  const tenant = tenantWhere(req, idx + 1);
  if (tenant.clause) { sql += ` AND ${tenant.clause}`; params.push(...tenant.params); }
  const res = await query(`${sql} RETURNING *`, params);
  if (!res.rows[0]) { const e = new Error('Client not found'); e.status = 404; throw e; }
  return res.rows[0];
};

const remove = async (id, req) => {
  let sql = 'DELETE FROM nakjm_clients WHERE id = $1';
  const params = [id];
  const tenant = tenantWhere(req, 2);
  if (tenant.clause) { sql += ` AND ${tenant.clause}`; params.push(...tenant.params); }
  const res = await query(`${sql} RETURNING id`, params);
  if (!res.rows[0]) { const e = new Error('Client not found'); e.status = 404; throw e; }
};

module.exports = { list, getOne, create, update, remove };
