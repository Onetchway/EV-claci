'use strict';

const { query } = require('../../config/database');
const { v4: uuidv4 } = require('uuid');

/**
 * List stations with filters and pagination
 */
async function listStations({ city, state, station_type, status, page = 1, limit = 20 }) {
  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (city) {
    conditions.push(`s.city ILIKE $${paramIndex++}`);
    params.push(`%${city}%`);
  }
  if (state) {
    conditions.push(`s.state ILIKE $${paramIndex++}`);
    params.push(`%${state}%`);
  }
  if (station_type) {
    conditions.push(`s.station_type = $${paramIndex++}`);
    params.push(station_type);
  }
  if (status) {
    conditions.push(`s.status = $${paramIndex++}`);
    params.push(status);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const offset = (parseInt(page) - 1) * parseInt(limit);

  const countResult = await query(
    `SELECT COUNT(*) FROM stations s ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count);

  const dataParams = [...params, parseInt(limit), offset];
  const dataResult = await query(
    `SELECT
      s.*,
      (SELECT COUNT(*) FROM assets a WHERE a.station_id = s.id) AS asset_count,
      (SELECT COUNT(*) FROM chargers c WHERE c.station_id = s.id) AS charger_count,
      (SELECT COUNT(*) FROM bss_stations b WHERE b.station_id = s.id) AS bss_count
     FROM stations s
     ${whereClause}
     ORDER BY s.created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    dataParams
  );

  return {
    data: dataResult.rows,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    },
  };
}

/**
 * Get a single station by ID with counts
 */
async function getStationById(id) {
  const result = await query(
    `SELECT
      s.*,
      (SELECT COUNT(*) FROM assets a WHERE a.station_id = s.id) AS asset_count,
      (SELECT COUNT(*) FROM chargers c WHERE c.station_id = s.id) AS charger_count,
      (SELECT COUNT(*) FROM bss_stations b WHERE b.station_id = s.id) AS bss_count,
      (SELECT COUNT(*) FROM charging_sessions cs WHERE cs.station_id = s.id AND cs.status = 'active') AS active_sessions
     FROM stations s
     WHERE s.id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

/**
 * Create a new station
 */
async function createStation(data) {
  const id = uuidv4();
  const {
    name,
    address,
    city,
    state,
    latitude,
    longitude,
    station_type,
    electricity_rate,
    selling_rate,
    status = 'active',
  } = data;

  const result = await query(
    `INSERT INTO stations
      (id, name, address, city, state, latitude, longitude, station_type, electricity_rate, selling_rate, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
     RETURNING *`,
    [id, name, address, city, state, latitude || null, longitude || null, station_type, electricity_rate || 0, selling_rate || 0, status]
  );

  return result.rows[0];
}

/**
 * Update a station
 */
async function updateStation(id, data) {
  const fields = [];
  const params = [];
  let paramIndex = 1;

  const allowedFields = ['name', 'address', 'city', 'state', 'latitude', 'longitude', 'station_type', 'electricity_rate', 'selling_rate', 'status'];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      fields.push(`${field} = $${paramIndex++}`);
      params.push(data[field]);
    }
  }

  if (fields.length === 0) {
    return null;
  }

  fields.push(`updated_at = NOW()`);
  params.push(id);

  const result = await query(
    `UPDATE stations SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    params
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

/**
 * Delete a station
 */
async function deleteStation(id) {
  const result = await query('DELETE FROM stations WHERE id = $1 RETURNING id', [id]);
  return result.rows.length > 0;
}

/**
 * Get station P&L summary for a date range
 */
async function getStationSummary(id, startDate, endDate) {
  const stationResult = await query('SELECT * FROM stations WHERE id = $1', [id]);
  if (stationResult.rows.length === 0) {
    return null;
  }

  const station = stationResult.rows[0];

  const params = [id];
  let dateCondition = '';
  let paramIndex = 2;

  if (startDate && endDate) {
    dateCondition = `AND date BETWEEN $${paramIndex++} AND $${paramIndex++}`;
    params.push(startDate, endDate);
  } else if (startDate) {
    dateCondition = `AND date >= $${paramIndex++}`;
    params.push(startDate);
  } else if (endDate) {
    dateCondition = `AND date <= $${paramIndex++}`;
    params.push(endDate);
  }

  const summaryResult = await query(
    `SELECT
      SUM(charging_revenue) AS total_charging_revenue,
      SUM(bss_swap_revenue) AS total_bss_swap_revenue,
      SUM(bss_rental_revenue) AS total_bss_rental_revenue,
      SUM(total_revenue) AS total_revenue,
      SUM(electricity_cost) AS total_electricity_cost,
      SUM(gross_margin) AS total_gross_margin,
      SUM(energy_consumed) AS total_energy_consumed,
      SUM(session_count) AS total_sessions,
      COUNT(*) AS days_with_data,
      MIN(date) AS from_date,
      MAX(date) AS to_date
     FROM revenues
     WHERE station_id = $1 ${dateCondition}`,
    params
  );

  const dailyResult = await query(
    `SELECT * FROM revenues WHERE station_id = $1 ${dateCondition} ORDER BY date ASC`,
    params
  );

  return {
    station,
    summary: summaryResult.rows[0],
    daily: dailyResult.rows,
  };
}

module.exports = {
  listStations,
  getStationById,
  createStation,
  updateStation,
  deleteStation,
  getStationSummary,
};
