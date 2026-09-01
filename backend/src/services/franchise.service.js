'use strict';

const { query } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { paginate, paginatedResponse } = require('../utils/pagination');
const { tenantWhere, tenantIdForInsert } = require('../middleware/tenantScope');

const list = async (filters, req) => {
  const { page, limit, skip } = paginate(filters);
  const conditions = [];
  const params = [];
  let idx = 1;

  const tenant = tenantWhere(req, idx);
  if (tenant.clause) { conditions.push(tenant.clause); params.push(...tenant.params); idx += tenant.params.length; }

  if (filters.status) { conditions.push(`status = $${idx++}`); params.push(filters.status); }
  if (filters.type)   { conditions.push(`type = $${idx++}`);   params.push(filters.type); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRes = await query(`SELECT COUNT(*) FROM franchises ${where}`, params);
  const total = parseInt(countRes.rows[0].count, 10);

  const dataRes = await query(
    `SELECT f.*,
      (SELECT COUNT(*) FROM assets     a WHERE a.franchise_id = f.id) AS asset_count,
      (SELECT COUNT(*) FROM settlements s WHERE s.franchise_id = f.id) AS settlement_count
     FROM franchises f ${where}
     ORDER BY f.created_at DESC
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
  const res = await query(`SELECT * FROM franchises WHERE ${conditions.join(' AND ')}`, params);
  if (!res.rows[0]) { const e = new Error('Franchise not found'); e.status = 404; throw e; }

  const [assetsRes, settlementsRes] = await Promise.all([
    query(
      `SELECT a.*, s.name AS station_name, s.city
       FROM assets a LEFT JOIN stations s ON s.id = a.station_id
       WHERE a.franchise_id = $1 ORDER BY a.created_at DESC`,
      [id]
    ),
    query(
      `SELECT * FROM settlements WHERE franchise_id = $1 ORDER BY created_at DESC LIMIT 6`,
      [id]
    ),
  ]);

  return { ...res.rows[0], assets: assetsRes.rows, recent_settlements: settlementsRes.rows };
};

const create = async (data, req) => {
  const {
    name, contact_name, contact_email, contact_phone = null,
    type, revenue_share_percent = 0, investment_amount = 0, status = 'active',
  } = data;
  if (!name || !contact_name || !contact_email || !type) {
    const e = new Error('name, contact_name, contact_email, and type are required'); e.status = 400; throw e;
  }
  const id = uuidv4();
  const res = await query(
    `INSERT INTO franchises (id, tenant_id, name, contact_name, contact_email, contact_phone, type, revenue_share_percent, investment_amount, status, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW()) RETURNING *`,
    [id, tenantIdForInsert(req), name, contact_name, contact_email, contact_phone, type, revenue_share_percent, investment_amount, status]
  );
  return res.rows[0];
};

const update = async (id, data, req) => {
  const allowed = ['name', 'contact_name', 'contact_email', 'contact_phone', 'type', 'revenue_share_percent', 'investment_amount', 'status'];
  const fields = []; const params = []; let idx = 1;
  for (const f of allowed) {
    if (data[f] !== undefined) { fields.push(`${f} = $${idx++}`); params.push(data[f]); }
  }
  if (!fields.length) { const e = new Error('No valid fields to update'); e.status = 400; throw e; }
  fields.push('updated_at = NOW()');
  params.push(id);
  let sql = `UPDATE franchises SET ${fields.join(', ')} WHERE id = $${idx}`;
  const tenant = tenantWhere(req, idx + 1);
  if (tenant.clause) { sql += ` AND ${tenant.clause}`; params.push(...tenant.params); }
  const res = await query(`${sql} RETURNING *`, params);
  if (!res.rows[0]) { const e = new Error('Franchise not found'); e.status = 404; throw e; }
  return res.rows[0];
};

const remove = async (id, req) => {
  let sql = 'DELETE FROM franchises WHERE id = $1';
  const params = [id];
  const tenant = tenantWhere(req, 2);
  if (tenant.clause) { sql += ` AND ${tenant.clause}`; params.push(...tenant.params); }
  const res = await query(`${sql} RETURNING id`, params);
  if (!res.rows[0]) { const e = new Error('Franchise not found'); e.status = 404; throw e; }
};

// Was flagged unscoped in an earlier pass; fixed to match dashboard.service.js's
// franchiseDashboard (GET /api/dashboard/franchise/:franchiseId) — this is a
// second, separately-routed dashboard for the same data (GET /api/franchises/:id/dashboard),
// so it needed the identical tenant-scoping treatment, not just a pointer to the other one.
const franchiseDashboard = async (id, req) => {
  const frTenant = tenantWhere(req, 2);
  const frRes = await query(
    `SELECT * FROM franchises WHERE id = $1${frTenant.clause ? ' AND ' + frTenant.clause : ''}`,
    [id, ...frTenant.params]
  );
  if (!frRes.rows[0]) { const e = new Error('Franchise not found'); e.status = 404; throw e; }
  const franchise = frRes.rows[0];

  const assetsTenant = tenantWhere(req, 2);
  const assetsRes = await query(
    `SELECT a.*, s.name AS station_name, s.city
     FROM assets a LEFT JOIN stations s ON s.id = a.station_id
     WHERE a.franchise_id = $1${assetsTenant.clause ? ' AND ' + assetsTenant.clause.replace('tenant_id', 'a.tenant_id') : ''}`,
    [id, ...assetsTenant.params]
  );
  const assets = assetsRes.rows;
  const stationIds = [...new Set(assets.map(a => a.station_id).filter(Boolean))];

  let totalRevenue = 0;
  if (stationIds.length > 0) {
    const placeholders = stationIds.map((_, i) => `$${i + 1}`).join(',');
    const revTenant = tenantWhere(req, stationIds.length + 1);
    const revRes = await query(
      `SELECT COALESCE(SUM(total_revenue),0) AS total FROM revenues WHERE station_id IN (${placeholders})${revTenant.clause ? ' AND ' + revTenant.clause : ''}`,
      [...stationIds, ...revTenant.params]
    );
    totalRevenue = parseFloat(revRes.rows[0].total);
  }

  const settlementsTenant = tenantWhere(req, 2);
  const settlementsRes = await query(
    `SELECT * FROM settlements WHERE franchise_id = $1${settlementsTenant.clause ? ' AND ' + settlementsTenant.clause : ''} ORDER BY created_at DESC`,
    [id, ...settlementsTenant.params]
  );
  const settlements = settlementsRes.rows;
  const totalEarned = settlements
    .filter(s => s.status === 'paid')
    .reduce((sum, s) => sum + parseFloat(s.franchise_share), 0);

  const pendingSettlements = settlements.filter(s => s.status === 'pending');

  const franchiseCut = parseFloat((totalRevenue * parseFloat(franchise.revenue_share_percent) / 100).toFixed(2));
  const roi = parseFloat(franchise.investment_amount) > 0
    ? parseFloat(((totalEarned / parseFloat(franchise.investment_amount)) * 100).toFixed(2))
    : 0;

  return {
    franchise,
    assets,
    total_investment: parseFloat(franchise.investment_amount),
    total_earnings: totalEarned,
    projected_earnings: franchiseCut,
    roi_percent: roi,
    pending_settlements: pendingSettlements,
    recent_settlements: settlements.slice(0, 6),
  };
};

module.exports = { list, getOne, create, update, remove, franchiseDashboard };
