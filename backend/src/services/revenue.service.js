'use strict';

const { query } = require('../config/database');
const { paginate, paginatedResponse } = require('../utils/pagination');

const list = async (filters) => {
  const { page, limit, skip } = paginate(filters);
  const conditions = [];
  const params = [];
  let idx = 1;

  if (filters.station_id) { conditions.push(`r.station_id = $${idx++}`); params.push(filters.station_id); }
  if (filters.stationId)  { conditions.push(`r.station_id = $${idx++}`); params.push(filters.stationId); }
  if (filters.from && filters.to) { conditions.push(`r.date BETWEEN $${idx++} AND $${idx++}`); params.push(filters.from, filters.to); }
  else if (filters.from) { conditions.push(`r.date >= $${idx++}`); params.push(filters.from); }
  else if (filters.to)   { conditions.push(`r.date <= $${idx++}`); params.push(filters.to); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRes = await query(`SELECT COUNT(*) FROM revenues r ${where}`, params);
  const total = parseInt(countRes.rows[0].count, 10);

  let groupBy = '';
  let selectDate = 'r.date';
  if (filters.group_by === 'month') {
    selectDate = `DATE_TRUNC('month', r.date) AS date`;
    groupBy = `GROUP BY DATE_TRUNC('month', r.date), r.station_id, s.name, s.city`;
  }

  const dataRes = await query(
    `SELECT
      ${filters.group_by === 'month' ? selectDate : 'r.date'}, r.station_id,
      s.name AS station_name, s.city,
      ${filters.group_by === 'month' ? `
        SUM(r.charging_revenue) AS charging_revenue,
        SUM(r.bss_swap_revenue) AS bss_swap_revenue,
        SUM(r.bss_rental_revenue) AS bss_rental_revenue,
        SUM(r.total_revenue) AS total_revenue,
        SUM(r.electricity_cost) AS electricity_cost,
        SUM(r.gross_margin) AS gross_margin,
        SUM(r.energy_consumed) AS energy_consumed,
        SUM(r.session_count) AS session_count
      ` : `
        r.charging_revenue, r.bss_swap_revenue, r.bss_rental_revenue,
        r.total_revenue, r.electricity_cost, r.gross_margin, r.energy_consumed, r.session_count
      `}
     FROM revenues r
     JOIN stations s ON s.id = r.station_id
     ${where}
     ${groupBy}
     ORDER BY date DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, skip]
  );

  return paginatedResponse(dataRes.rows, total, page, limit);
};

const summary = async (filters) => {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (filters.station_id) { conditions.push(`station_id = $${idx++}`); params.push(filters.station_id); }
  if (filters.stationId)  { conditions.push(`station_id = $${idx++}`); params.push(filters.stationId); }
  if (filters.from && filters.to) { conditions.push(`date BETWEEN $${idx++} AND $${idx++}`); params.push(filters.from, filters.to); }
  else if (filters.from) { conditions.push(`date >= $${idx++}`); params.push(filters.from); }
  else if (filters.to)   { conditions.push(`date <= $${idx++}`); params.push(filters.to); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const res = await query(
    `SELECT
      COALESCE(SUM(charging_revenue),0)   AS total_charging_revenue,
      COALESCE(SUM(bss_swap_revenue),0)   AS total_bss_swap_revenue,
      COALESCE(SUM(bss_rental_revenue),0) AS total_bss_rental_revenue,
      COALESCE(SUM(total_revenue),0)      AS total_revenue,
      COALESCE(SUM(electricity_cost),0)   AS total_electricity_cost,
      COALESCE(SUM(gross_margin),0)       AS total_gross_margin,
      COALESCE(SUM(energy_consumed),0)    AS total_energy_consumed,
      COALESCE(SUM(session_count),0)      AS total_sessions,
      COUNT(*)                            AS days_count,
      MIN(date)                           AS from_date,
      MAX(date)                           AS to_date
     FROM revenues ${where}`,
    params
  );
  return res.rows[0];
};

const byStation = async (stationId, filters = {}) => {
  const conditions = [`r.station_id = $1`]; const params = [stationId]; let idx = 2;

  if (filters.from && filters.to) { conditions.push(`r.date BETWEEN $${idx++} AND $${idx++}`); params.push(filters.from, filters.to); }
  else if (filters.from) { conditions.push(`r.date >= $${idx++}`); params.push(filters.from); }
  else if (filters.to)   { conditions.push(`r.date <= $${idx++}`); params.push(filters.to); }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const res = await query(
    `SELECT r.*, s.name AS station_name FROM revenues r JOIN stations s ON s.id = r.station_id ${where} ORDER BY r.date ASC`,
    params
  );
  return res.rows;
};

const getPnL = async (stationId, filters = {}) => {
  const stRes = await query('SELECT * FROM stations WHERE id = $1', [stationId]);
  if (!stRes.rows[0]) { const e = new Error('Station not found'); e.status = 404; throw e; }

  const conditions = [`station_id = $1`]; const params = [stationId]; let idx = 2;
  if (filters.start_date && filters.end_date) { conditions.push(`date BETWEEN $${idx++} AND $${idx++}`); params.push(filters.start_date, filters.end_date); }
  else if (filters.start_date) { conditions.push(`date >= $${idx++}`); params.push(filters.start_date); }
  else if (filters.end_date)   { conditions.push(`date <= $${idx++}`); params.push(filters.end_date); }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const dailyRes = await query(`SELECT * FROM revenues ${where} ORDER BY date ASC`, params);

  // Running totals
  let runRevenue = 0, runCost = 0, runMargin = 0, runEnergy = 0;
  const withRunning = dailyRes.rows.map(row => {
    runRevenue += parseFloat(row.total_revenue || 0);
    runCost    += parseFloat(row.electricity_cost || 0);
    runMargin  += parseFloat(row.gross_margin || 0);
    runEnergy  += parseFloat(row.energy_consumed || 0);
    return { ...row, running_revenue: runRevenue, running_cost: runCost, running_margin: runMargin, running_energy: runEnergy };
  });

  const totals = {
    total_revenue: runRevenue,
    total_cost: runCost,
    gross_margin: runMargin,
    total_energy: runEnergy,
    days: dailyRes.rows.length,
  };

  return { station: stRes.rows[0], totals, daily: withRunning };
};

const exportForCsv = async (filters) => {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (filters.station_id) { conditions.push(`r.station_id = $${idx++}`); params.push(filters.station_id); }
  if (filters.from && filters.to) { conditions.push(`r.date BETWEEN $${idx++} AND $${idx++}`); params.push(filters.from, filters.to); }
  else if (filters.from) { conditions.push(`r.date >= $${idx++}`); params.push(filters.from); }
  else if (filters.to)   { conditions.push(`r.date <= $${idx++}`); params.push(filters.to); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const res = await query(
    `SELECT r.date, s.name AS station_name, s.city,
      r.charging_revenue, r.bss_swap_revenue, r.bss_rental_revenue,
      r.total_revenue, r.electricity_cost, r.gross_margin, r.energy_consumed, r.session_count
     FROM revenues r
     JOIN stations s ON s.id = r.station_id
     ${where}
     ORDER BY r.date DESC`,
    params
  );
  return res.rows;
};

// Compute (recompute) daily revenue for a station from raw sessions and bss_swaps
const computeRevenue = async (stationId, dateStr) => {
  const dateToUse = dateStr || new Date().toISOString().split('T')[0];

  const stRes = await query('SELECT * FROM stations WHERE id = $1', [stationId]);
  if (!stRes.rows[0]) { const e = new Error('Station not found'); e.status = 404; throw e; }
  const station = stRes.rows[0];

  const [sessionsRes, swapsRes] = await Promise.all([
    query(
      `SELECT * FROM charging_sessions WHERE station_id=$1 AND status='completed' AND DATE(end_time)=$2`,
      [stationId, dateToUse]
    ),
    query(
      `SELECT * FROM bss_swaps WHERE station_id=$1 AND swap_date=$2`,
      [stationId, dateToUse]
    ),
  ]);

  const energyKwh = sessionsRes.rows.reduce((s, r) => s + parseFloat(r.energy_kwh || 0), 0);
  const chargingRevenue = parseFloat((energyKwh * parseFloat(station.selling_rate)).toFixed(2));
  const electricityCost = parseFloat((energyKwh * parseFloat(station.electricity_rate)).toFixed(2));
  const bssSwapRevenue = swapsRes.rows.filter(r => r.swap_type === 'swap').reduce((s, r) => s + parseFloat(r.amount || 0), 0);
  const bssRentalRevenue = swapsRes.rows.filter(r => r.swap_type === 'rental_start').reduce((s, r) => s + parseFloat(r.amount || 0), 0);
  const totalRevenue = parseFloat((chargingRevenue + bssSwapRevenue + bssRentalRevenue).toFixed(2));
  const grossMargin = parseFloat((totalRevenue - electricityCost).toFixed(2));

  const { v4: uuidv4 } = require('uuid');
  const res = await query(
    `INSERT INTO revenues (id, station_id, date, charging_revenue, bss_swap_revenue, bss_rental_revenue, total_revenue, electricity_cost, gross_margin, energy_consumed, session_count, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW())
     ON CONFLICT (station_id, date) DO UPDATE SET
       charging_revenue   = EXCLUDED.charging_revenue,
       bss_swap_revenue   = EXCLUDED.bss_swap_revenue,
       bss_rental_revenue = EXCLUDED.bss_rental_revenue,
       total_revenue      = EXCLUDED.total_revenue,
       electricity_cost   = EXCLUDED.electricity_cost,
       gross_margin       = EXCLUDED.gross_margin,
       energy_consumed    = EXCLUDED.energy_consumed,
       session_count      = EXCLUDED.session_count,
       updated_at         = NOW()
     RETURNING *`,
    [uuidv4(), stationId, dateToUse, chargingRevenue, bssSwapRevenue, bssRentalRevenue, totalRevenue, electricityCost, grossMargin, energyKwh, sessionsRes.rows.length]
  );
  return res.rows[0];
};

module.exports = { list, summary, byStation, getPnL, exportForCsv, computeRevenue };
