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
  if (tenant.clause) { conditions.push(tenant.clause.replace('tenant_id', 'p.tenant_id')); params.push(...tenant.params); idx += tenant.params.length; }

  if (filters.status)       { conditions.push(`p.status = $${idx++}`);       params.push(filters.status); }
  if (filters.client_id)    { conditions.push(`p.client_id = $${idx++}`);    params.push(filters.client_id); }
  if (filters.project_type) { conditions.push(`p.project_type = $${idx++}`); params.push(filters.project_type); }
  if (filters.search)       { conditions.push(`(p.name ILIKE $${idx} OR p.project_code ILIKE $${idx})`); params.push(`%${filters.search}%`); idx++; }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRes = await query(`SELECT COUNT(*) FROM nakjm_projects p ${where}`, params);
  const total = parseInt(countRes.rows[0].count, 10);

  const dataRes = await query(
    `SELECT p.*, c.name AS client_name, tm.name AS project_manager_name,
      (SELECT COALESCE(SUM(amount),0) FROM nakjm_client_payments cp WHERE cp.project_id = p.id) AS collected_amount,
      (SELECT COALESCE(SUM(amount),0) FROM nakjm_vendor_payments vp WHERE vp.project_id = p.id) AS paid_to_vendors
     FROM nakjm_projects p
     LEFT JOIN nakjm_clients c ON c.id = p.client_id
     LEFT JOIN nakjm_team_members tm ON tm.id = p.project_manager_id
     ${where}
     ORDER BY p.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, skip]
  );

  return paginatedResponse(dataRes.rows, total, page, limit);
};

const getOne = async (id, req) => {
  const conditions = ['p.id = $1'];
  const params = [id];
  const tenant = tenantWhere(req, 2);
  if (tenant.clause) { conditions.push(tenant.clause.replace('tenant_id', 'p.tenant_id')); params.push(...tenant.params); }
  const res = await query(
    `SELECT p.*, c.name AS client_name, c.contact_name AS client_contact_name, c.contact_email AS client_contact_email,
      tm.name AS project_manager_name
     FROM nakjm_projects p
     LEFT JOIN nakjm_clients c ON c.id = p.client_id
     LEFT JOIN nakjm_team_members tm ON tm.id = p.project_manager_id
     WHERE ${conditions.join(' AND ')}`,
    params
  );
  if (!res.rows[0]) { const e = new Error('Project not found'); e.status = 404; throw e; }
  return res.rows[0];
};

const create = async (data, req) => {
  const {
    project_code, name, client_id, project_manager_id = null, project_type = 'ev_charging_station',
    site_address = null, city = null, state = null, capacity_kw = null, status = 'lead',
    start_date = null, target_end_date = null, budget_amount = 0, contract_value = 0,
    poc_name = null, poc_phone = null, poc_email = null, notes = null, source_document_id = null,
  } = data;
  if (!project_code || !name || !client_id) {
    const e = new Error('project_code, name, and client_id are required'); e.status = 400; throw e;
  }
  const id = uuidv4();
  const res = await query(
    `INSERT INTO nakjm_projects (id, tenant_id, project_code, name, client_id, project_manager_id, project_type, site_address, city, state, capacity_kw, status, start_date, target_end_date, budget_amount, contract_value, poc_name, poc_phone, poc_email, notes, source_document_id, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,NOW(),NOW()) RETURNING *`,
    [id, tenantIdForInsert(req), project_code, name, client_id, project_manager_id, project_type, site_address, city, state, capacity_kw, status, start_date, target_end_date, budget_amount, contract_value, poc_name, poc_phone, poc_email, notes, source_document_id]
  );
  return res.rows[0];
};

const update = async (id, data, req) => {
  const allowed = [
    'project_code', 'name', 'client_id', 'project_manager_id', 'project_type', 'site_address', 'city', 'state',
    'capacity_kw', 'status', 'start_date', 'target_end_date', 'actual_end_date', 'budget_amount', 'contract_value',
    'poc_name', 'poc_phone', 'poc_email', 'notes',
  ];
  const fields = []; const params = []; let idx = 1;
  for (const f of allowed) {
    if (data[f] !== undefined) { fields.push(`${f} = $${idx++}`); params.push(data[f]); }
  }
  if (!fields.length) { const e = new Error('No valid fields to update'); e.status = 400; throw e; }
  fields.push('updated_at = NOW()');
  params.push(id);
  let sql = `UPDATE nakjm_projects SET ${fields.join(', ')} WHERE id = $${idx}`;
  const tenant = tenantWhere(req, idx + 1);
  if (tenant.clause) { sql += ` AND ${tenant.clause}`; params.push(...tenant.params); }
  const res = await query(`${sql} RETURNING *`, params);
  if (!res.rows[0]) { const e = new Error('Project not found'); e.status = 404; throw e; }
  return res.rows[0];
};

const remove = async (id, req) => {
  let sql = 'DELETE FROM nakjm_projects WHERE id = $1';
  const params = [id];
  const tenant = tenantWhere(req, 2);
  if (tenant.clause) { sql += ` AND ${tenant.clause}`; params.push(...tenant.params); }
  const res = await query(`${sql} RETURNING id`, params);
  if (!res.rows[0]) { const e = new Error('Project not found'); e.status = 404; throw e; }
};

// ── Project-scoped analytics: budget vs actual, collection %, site progress ──
const analytics = async (id, req) => {
  const conditions = ['id = $1'];
  const params = [id];
  const tenant0 = tenantWhere(req, 2);
  if (tenant0.clause) { conditions.push(tenant0.clause); params.push(...tenant0.params); }
  const projRes = await query(`SELECT * FROM nakjm_projects WHERE ${conditions.join(' AND ')}`, params);
  if (!projRes.rows[0]) { const e = new Error('Project not found'); e.status = 404; throw e; }
  const project = projRes.rows[0];

  const [poRes, vendorPaidRes, clientCollectedRes, piRes, progressRes] = await Promise.all([
    query('SELECT COALESCE(SUM(total_amount),0) AS total FROM nakjm_purchase_orders WHERE project_id = $1 AND status != $2', [id, 'cancelled']),
    query('SELECT COALESCE(SUM(amount),0) AS total FROM nakjm_vendor_payments WHERE project_id = $1', [id]),
    query('SELECT COALESCE(SUM(amount),0) AS total FROM nakjm_client_payments WHERE project_id = $1', [id]),
    query('SELECT COALESCE(SUM(total_amount),0) AS invoiced FROM nakjm_proforma_invoices WHERE project_id = $1 AND status != $2', [id, 'cancelled']),
    query('SELECT progress_percent FROM nakjm_site_reports WHERE project_id = $1 ORDER BY report_date DESC LIMIT 1', [id]),
  ]);

  const committedToVendors = parseFloat(poRes.rows[0].total);
  const paidToVendors = parseFloat(vendorPaidRes.rows[0].total);
  const collectedFromClient = parseFloat(clientCollectedRes.rows[0].total);
  const invoicedToClient = parseFloat(piRes.rows[0].invoiced);
  const contractValue = parseFloat(project.contract_value);
  const budget = parseFloat(project.budget_amount);
  const latestProgress = progressRes.rows[0] ? parseFloat(progressRes.rows[0].progress_percent) : 0;

  return {
    project_id: id,
    budget_amount: budget,
    contract_value: contractValue,
    committed_to_vendors: committedToVendors,
    paid_to_vendors: paidToVendors,
    vendor_outstanding: committedToVendors - paidToVendors,
    budget_utilization_percent: budget > 0 ? parseFloat(((paidToVendors / budget) * 100).toFixed(2)) : 0,
    invoiced_to_client: invoicedToClient,
    collected_from_client: collectedFromClient,
    collection_pending: Math.max(invoicedToClient - collectedFromClient, 0),
    collection_percent: contractValue > 0 ? parseFloat(((collectedFromClient / contractValue) * 100).toFixed(2)) : 0,
    latest_site_progress_percent: latestProgress,
    estimated_margin: contractValue - committedToVendors,
  };
};

module.exports = { list, getOne, create, update, remove, analytics };
