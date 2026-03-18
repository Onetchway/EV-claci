'use strict';

const { query } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { paginate, paginatedResponse } = require('../utils/pagination');

const list = async (filters) => {
  const { page, limit, skip } = paginate(filters);
  const conditions = [];
  const params = [];
  let idx = 1;

  if (filters.city)         { conditions.push(`s.city ILIKE $${idx++}`);     params.push(`%${filters.city}%`); }
  if (filters.state)        { conditions.push(`s.state ILIKE $${idx++}`);    params.push(`%${filters.state}%`); }
  if (filters.station_type) { conditions.push(`s.station_type = $${idx++}`); params.push(filters.station_type); }
  if (filters.status)       { conditions.push(`s.status = $${idx++}`);       params.push(filters.status); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRes = await query(`SELECT COUNT(*) FROM stations s ${where}`, params);
  const total = parseInt(countRes.rows[0].count, 10);

  const dataRes = await query(
    `SELECT s.*,
      (SELECT COUNT(*) FROM assets        a  WHERE a.station_id  = s.id) AS asset_count,
      (SELECT COUNT(*) FROM chargers      c  WHERE c.station_id  = s.id) AS charger_count,
      (SELECT COUNT(*) FROM bss_stations  bs WHERE bs.station_id = s.id) AS bss_count
     FROM stations s ${where}
     ORDER BY s.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, skip]
  );

  return paginatedResponse(dataRes.rows, total, page, limit);
};

const getOne = async (id) => {
  const res = await query(
    `SELECT s.*,
      (SELECT COUNT(*) FROM assets        a  WHERE a.station_id  = s.id) AS asset_count,
      (SELECT COUNT(*) FROM chargers      c  WHERE c.station_id  = s.id) AS charger_count,
      (SELECT COUNT(*) FROM bss_stations  bs WHERE bs.station_id = s.id) AS bss_count,
      (SELECT COUNT(*) FROM charging_sessions cs WHERE cs.station_id = s.id AND cs.status = 'active') AS active_sessions
     FROM stations s WHERE s.id = $1`,
    [id]
  );
  if (!res.rows[0]) { const e = new Error('Station not found'); e.status = 404; throw e; }
  return res.rows[0];
};

const create = async (data) => {
  const { name, address, city, state, latitude = null, longitude = null, station_type, electricity_rate = 0, selling_rate = 0, status = 'active' } = data;
  if (!name || !address || !city || !state || !station_type) {
    const e = new Error('name, address, city, state, station_type are required'); e.status = 400; throw e;
  }
  const id = uuidv4();
  const res = await query(
    `INSERT INTO stations (id, name, address, city, state, latitude, longitude, station_type, electricity_rate, selling_rate, status, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW()) RETURNING *`,
    [id, name, address, city, state, latitude, longitude, station_type, electricity_rate, selling_rate, status]
  );
  return res.rows[0];
};

const update = async (id, data) => {
  const allowed = ['name', 'address', 'city', 'state', 'latitude', 'longitude', 'station_type', 'electricity_rate', 'selling_rate', 'status'];
  const fields = []; const params = []; let idx = 1;
  for (const f of allowed) {
    if (data[f] !== undefined) { fields.push(`${f} = $${idx++}`); params.push(data[f]); }
  }
  if (!fields.length) { const e = new Error('No valid fields to update'); e.status = 400; throw e; }
  fields.push('updated_at = NOW()');
  params.push(id);
  const res = await query(`UPDATE stations SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, params);
  if (!res.rows[0]) { const e = new Error('Station not found'); e.status = 404; throw e; }
  return res.rows[0];
};

const remove = async (id) => {
  const res = await query('DELETE FROM stations WHERE id = $1 RETURNING id', [id]);
  if (!res.rows[0]) { const e = new Error('Station not found'); e.status = 404; throw e; }
};

const stats = async (id, filters = {}) => {
  const stRes = await query('SELECT * FROM stations WHERE id = $1', [id]);
  if (!stRes.rows[0]) { const e = new Error('Station not found'); e.status = 404; throw e; }

  const conds = ['station_id = $1']; const params = [id]; let idx = 2;
  if (filters.start_date && filters.end_date) {
    conds.push(`date BETWEEN $${idx++} AND $${idx++}`); params.push(filters.start_date, filters.end_date);
  } else if (filters.start_date) { conds.push(`date >= $${idx++}`); params.push(filters.start_date); }
  else if (filters.end_date)     { conds.push(`date <= $${idx++}`); params.push(filters.end_date); }

  const where = `WHERE ${conds.join(' AND ')}`;
  const sumRes = await query(
    `SELECT SUM(charging_revenue) AS total_charging_revenue, SUM(bss_swap_revenue) AS total_bss_swap_revenue,
            SUM(bss_rental_revenue) AS total_bss_rental_revenue, SUM(total_revenue) AS total_revenue,
            SUM(electricity_cost) AS total_electricity_cost, SUM(gross_margin) AS total_gross_margin,
            SUM(energy_consumed) AS total_energy_consumed, SUM(session_count) AS total_sessions,
            COUNT(*) AS days_with_data, MIN(date) AS from_date, MAX(date) AS to_date
     FROM revenues ${where}`, params
  );
  const dailyRes = await query(`SELECT * FROM revenues ${where} ORDER BY date ASC`, params);
  return { station: stRes.rows[0], summary: sumRes.rows[0], daily: dailyRes.rows };
};

module.exports = { list, getOne, create, update, remove, stats };
