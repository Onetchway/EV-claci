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
  if (tenant.clause) { conditions.push(tenant.clause.replace('tenant_id', 's.tenant_id')); params.push(...tenant.params); idx += tenant.params.length; }

  if (filters.franchise_id) { conditions.push(`s.franchise_id = $${idx++}`); params.push(filters.franchise_id); }
  if (filters.franchiseId)  { conditions.push(`s.franchise_id = $${idx++}`); params.push(filters.franchiseId); }
  if (filters.status)       { conditions.push(`s.status = $${idx++}`);       params.push(filters.status); }
  if (filters.station_id)   { conditions.push(`s.station_id = $${idx++}`);   params.push(filters.station_id); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRes = await query(`SELECT COUNT(*) FROM settlements s ${where}`, params);
  const total = parseInt(countRes.rows[0].count, 10);

  const dataRes = await query(
    `SELECT s.*, f.name AS franchise_name, f.revenue_share_percent, st.name AS station_name
     FROM settlements s
     JOIN franchises f ON f.id = s.franchise_id
     JOIN stations st ON st.id = s.station_id
     ${where}
     ORDER BY s.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, skip]
  );

  return paginatedResponse(dataRes.rows, total, page, limit);
};

const getOne = async (id, req) => {
  const conditions = ['s.id = $1'];
  const params = [id];
  const tenant = tenantWhere(req, 2);
  if (tenant.clause) { conditions.push(tenant.clause.replace('tenant_id', 's.tenant_id')); params.push(...tenant.params); }

  const res = await query(
    `SELECT s.*, f.name AS franchise_name, f.contact_email, f.revenue_share_percent, st.name AS station_name, st.city
     FROM settlements s
     JOIN franchises f ON f.id = s.franchise_id
     JOIN stations st ON st.id = s.station_id
     WHERE ${conditions.join(' AND ')}`,
    params
  );
  if (!res.rows[0]) { const e = new Error('Settlement not found'); e.status = 404; throw e; }
  return res.rows[0];
};

const generate = async ({ franchise_id, franchiseId, station_id, stationId, period_start, periodStart, period_end, periodEnd }, req) => {
  const fid = franchise_id || franchiseId;
  const sid = station_id || stationId;
  const pStart = period_start || periodStart;
  const pEnd = period_end || periodEnd;

  if (!fid || !sid || !pStart || !pEnd) {
    const e = new Error('franchise_id, station_id, period_start, and period_end are required'); e.status = 400; throw e;
  }

  const frRes = await query('SELECT * FROM franchises WHERE id = $1', [fid]);
  if (!frRes.rows[0]) { const e = new Error('Franchise not found'); e.status = 404; throw e; }
  const franchise = frRes.rows[0];

  const revRes = await query(
    `SELECT COALESCE(SUM(total_revenue),0) AS total
     FROM revenues
     WHERE station_id = $1 AND date BETWEEN $2 AND $3`,
    [sid, pStart, pEnd]
  );
  const totalRevenue = parseFloat(revRes.rows[0].total);
  const franchiseShare = parseFloat((totalRevenue * parseFloat(franchise.revenue_share_percent) / 100).toFixed(2));
  const companyShare = parseFloat((totalRevenue - franchiseShare).toFixed(2));

  const id = uuidv4();
  const res = await query(
    `INSERT INTO settlements (id, tenant_id, franchise_id, station_id, period_start, period_end, total_revenue, franchise_share, company_share, status, generated_at, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',NOW(),NOW()) RETURNING *`,
    [id, tenantIdForInsert(req), fid, sid, pStart, pEnd, totalRevenue, franchiseShare, companyShare]
  );

  const full = await query(
    `SELECT s.*, f.name AS franchise_name, st.name AS station_name
     FROM settlements s
     JOIN franchises f ON f.id = s.franchise_id
     JOIN stations st ON st.id = s.station_id
     WHERE s.id = $1`,
    [id]
  );
  return full.rows[0];
};

const approve = async (id, req) => {
  let sql = `UPDATE settlements SET status='approved' WHERE id=$1 AND status='pending'`;
  const params = [id];
  const tenant = tenantWhere(req, 2);
  if (tenant.clause) { sql += ` AND ${tenant.clause}`; params.push(...tenant.params); }
  const res = await query(`${sql} RETURNING *`, params);
  if (!res.rows[0]) {
    let existingSql = 'SELECT status FROM settlements WHERE id=$1';
    const existingParams = [id];
    if (tenant.clause) { existingSql += ` AND ${tenant.clause}`; existingParams.push(...tenant.params); }
    const existing = await query(existingSql, existingParams);
    if (!existing.rows[0]) { const e = new Error('Settlement not found'); e.status = 404; throw e; }
    const e = new Error(`Cannot approve settlement with status: ${existing.rows[0].status}`); e.status = 409; throw e;
  }
  return res.rows[0];
};

const markPaid = async (id, req) => {
  let sql = `UPDATE settlements SET status='paid', paid_at=NOW() WHERE id=$1 AND status='approved'`;
  const params = [id];
  const tenant = tenantWhere(req, 2);
  if (tenant.clause) { sql += ` AND ${tenant.clause}`; params.push(...tenant.params); }
  const res = await query(`${sql} RETURNING *`, params);
  if (!res.rows[0]) {
    let existingSql = 'SELECT status FROM settlements WHERE id=$1';
    const existingParams = [id];
    if (tenant.clause) { existingSql += ` AND ${tenant.clause}`; existingParams.push(...tenant.params); }
    const existing = await query(existingSql, existingParams);
    if (!existing.rows[0]) { const e = new Error('Settlement not found'); e.status = 404; throw e; }
    const e = new Error(`Cannot mark as paid. Settlement status: ${existing.rows[0].status}`); e.status = 409; throw e;
  }
  return res.rows[0];
};

const updateStatus = async (id, status, notes, req) => {
  const valid = ['pending', 'approved', 'paid'];
  if (!valid.includes(status)) {
    const e = new Error(`status must be one of: ${valid.join(', ')}`); e.status = 400; throw e;
  }
  let sql = `UPDATE settlements SET status=$1, ${status === 'paid' ? 'paid_at=NOW(),' : ''} updated_at=NOW()
     WHERE id=$2`;
  const params = [status, id];
  const tenant = tenantWhere(req, 3);
  if (tenant.clause) { sql += ` AND ${tenant.clause}`; params.push(...tenant.params); }
  const res = await query(`${sql} RETURNING *`, params);
  if (!res.rows[0]) { const e = new Error('Settlement not found'); e.status = 404; throw e; }
  return res.rows[0];
};

const getReport = async (id, req) => {
  const settlement = await getOne(id, req);

  const [dailyRevRes, frAssetsRes] = await Promise.all([
    query(
      `SELECT * FROM revenues WHERE station_id=$1 AND date BETWEEN $2 AND $3 ORDER BY date ASC`,
      [settlement.station_id, settlement.period_start, settlement.period_end]
    ),
    query(
      `SELECT a.*, s.name AS station_name FROM assets a LEFT JOIN stations s ON s.id = a.station_id
       WHERE a.franchise_id=$1 AND a.station_id=$2`,
      [settlement.franchise_id, settlement.station_id]
    ),
  ]);

  return {
    settlement,
    daily_revenue: dailyRevRes.rows,
    franchise_assets: frAssetsRes.rows,
  };
};

module.exports = { list, getOne, generate, approve, markPaid, updateStatus, getReport };
