'use strict';

const { query } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { paginate, paginatedResponse } = require('../utils/pagination');

const list = async (filters) => {
  const { page, limit, skip } = paginate(filters);
  const conditions = [];
  const params = [];
  let idx = 1;

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

const getOne = async (id) => {
  const res = await query('SELECT * FROM franchises WHERE id = $1', [id]);
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

const create = async (data) => {
  const {
    name, contact_name, contact_email, contact_phone = null,
    type, revenue_share_percent = 0, investment_amount = 0, status = 'active',
  } = data;
  if (!name || !contact_name || !contact_email || !type) {
    const e = new Error('name, contact_name, contact_email, and type are required'); e.status = 400; throw e;
  }
  const id = uuidv4();
  const res = await query(
    `INSERT INTO franchises (id, name, contact_name, contact_email, contact_phone, type, revenue_share_percent, investment_amount, status, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW()) RETURNING *`,
    [id, name, contact_name, contact_email, contact_phone, type, revenue_share_percent, investment_amount, status]
  );
  return res.rows[0];
};

const update = async (id, data) => {
  const allowed = ['name', 'contact_name', 'contact_email', 'contact_phone', 'type', 'revenue_share_percent', 'investment_amount', 'status'];
  const fields = []; const params = []; let idx = 1;
  for (const f of allowed) {
    if (data[f] !== undefined) { fields.push(`${f} = $${idx++}`); params.push(data[f]); }
  }
  if (!fields.length) { const e = new Error('No valid fields to update'); e.status = 400; throw e; }
  fields.push('updated_at = NOW()');
  params.push(id);
  const res = await query(`UPDATE franchises SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, params);
  if (!res.rows[0]) { const e = new Error('Franchise not found'); e.status = 404; throw e; }
  return res.rows[0];
};

const remove = async (id) => {
  const res = await query('DELETE FROM franchises WHERE id = $1 RETURNING id', [id]);
  if (!res.rows[0]) { const e = new Error('Franchise not found'); e.status = 404; throw e; }
};

const franchiseDashboard = async (id) => {
  const frRes = await query('SELECT * FROM franchises WHERE id = $1', [id]);
  if (!frRes.rows[0]) { const e = new Error('Franchise not found'); e.status = 404; throw e; }
  const franchise = frRes.rows[0];

  const assetsRes = await query(
    `SELECT a.*, s.name AS station_name, s.city
     FROM assets a LEFT JOIN stations s ON s.id = a.station_id
     WHERE a.franchise_id = $1`,
    [id]
  );
  const assets = assetsRes.rows;
  const stationIds = [...new Set(assets.map(a => a.station_id).filter(Boolean))];

  let totalRevenue = 0;
  if (stationIds.length > 0) {
    const placeholders = stationIds.map((_, i) => `$${i + 1}`).join(',');
    const revRes = await query(
      `SELECT COALESCE(SUM(total_revenue),0) AS total FROM revenues WHERE station_id IN (${placeholders})`,
      stationIds
    );
    totalRevenue = parseFloat(revRes.rows[0].total);
  }

  const settlementsRes = await query(
    `SELECT * FROM settlements WHERE franchise_id = $1 ORDER BY created_at DESC`,
    [id]
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
