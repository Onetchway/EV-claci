'use strict';

const { query } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { paginate, paginatedResponse } = require('../utils/pagination');

const list = async (filters) => {
  const { page, limit, skip } = paginate(filters);
  const conditions = [];
  const params = [];
  let idx = 1;

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

const getOne = async (id) => {
  const res = await query(
    `SELECT s.*, f.name AS franchise_name, f.contact_email, f.revenue_share_percent, st.name AS station_name, st.city
     FROM settlements s
     JOIN franchises f ON f.id = s.franchise_id
     JOIN stations st ON st.id = s.station_id
     WHERE s.id = $1`,
    [id]
  );
  if (!res.rows[0]) { const e = new Error('Settlement not found'); e.status = 404; throw e; }
  return res.rows[0];
};

const generate = async ({ franchise_id, franchiseId, station_id, stationId, period_start, periodStart, period_end, periodEnd }) => {
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
    `INSERT INTO settlements (id, franchise_id, station_id, period_start, period_end, total_revenue, franchise_share, company_share, status, generated_at, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',NOW(),NOW()) RETURNING *`,
    [id, fid, sid, pStart, pEnd, totalRevenue, franchiseShare, companyShare]
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

const approve = async (id) => {
  const res = await query(
    `UPDATE settlements SET status='approved' WHERE id=$1 AND status='pending' RETURNING *`,
    [id]
  );
  if (!res.rows[0]) {
    const existing = await query('SELECT status FROM settlements WHERE id=$1', [id]);
    if (!existing.rows[0]) { const e = new Error('Settlement not found'); e.status = 404; throw e; }
    const e = new Error(`Cannot approve settlement with status: ${existing.rows[0].status}`); e.status = 409; throw e;
  }
  return res.rows[0];
};

const markPaid = async (id) => {
  const res = await query(
    `UPDATE settlements SET status='paid', paid_at=NOW() WHERE id=$1 AND status='approved' RETURNING *`,
    [id]
  );
  if (!res.rows[0]) {
    const existing = await query('SELECT status FROM settlements WHERE id=$1', [id]);
    if (!existing.rows[0]) { const e = new Error('Settlement not found'); e.status = 404; throw e; }
    const e = new Error(`Cannot mark as paid. Settlement status: ${existing.rows[0].status}`); e.status = 409; throw e;
  }
  return res.rows[0];
};

const updateStatus = async (id, status, notes) => {
  const valid = ['pending', 'approved', 'paid'];
  if (!valid.includes(status)) {
    const e = new Error(`status must be one of: ${valid.join(', ')}`); e.status = 400; throw e;
  }
  const res = await query(
    `UPDATE settlements SET status=$1, ${status === 'paid' ? 'paid_at=NOW(),' : ''} updated_at=NOW()
     WHERE id=$2 RETURNING *`,
    [status, id]
  );
  if (!res.rows[0]) { const e = new Error('Settlement not found'); e.status = 404; throw e; }
  return res.rows[0];
};

const getReport = async (id) => {
  const settlement = await getOne(id);

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
