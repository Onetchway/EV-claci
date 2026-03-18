'use strict';

const { query, getClient } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { paginate, paginatedResponse } = require('../utils/pagination');

const list = async (filters) => {
  const { page, limit, skip } = paginate(filters);
  const conditions = [];
  const params = [];
  let idx = 1;

  if (filters.station_id) { conditions.push(`c.station_id = $${idx++}`); params.push(filters.station_id); }
  if (filters.stationId)  { conditions.push(`c.station_id = $${idx++}`); params.push(filters.stationId); }
  if (filters.status)     { conditions.push(`c.status = $${idx++}`);     params.push(filters.status); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRes = await query(`SELECT COUNT(*) FROM chargers c ${where}`, params);
  const total = parseInt(countRes.rows[0].count, 10);

  const dataRes = await query(
    `SELECT c.*, s.name AS station_name, s.electricity_rate, s.selling_rate
     FROM chargers c
     JOIN stations s ON s.id = c.station_id
     ${where}
     ORDER BY c.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, skip]
  );

  return paginatedResponse(dataRes.rows, total, page, limit);
};

const getOne = async (id) => {
  const res = await query(
    `SELECT c.*, s.name AS station_name, s.electricity_rate, s.selling_rate
     FROM chargers c
     JOIN stations s ON s.id = c.station_id
     WHERE c.id = $1`,
    [id]
  );
  if (!res.rows[0]) { const e = new Error('Charger not found'); e.status = 404; throw e; }
  const sessions = await query(
    `SELECT * FROM charging_sessions WHERE charger_id = $1 ORDER BY created_at DESC LIMIT 10`,
    [id]
  );
  return { ...res.rows[0], recent_sessions: sessions.rows };
};

const create = async (data) => {
  const { asset_id = null, station_id, connector_type, power_rating = 0, ocpp_id = null, status = 'available' } = data;
  if (!station_id || !connector_type) {
    const e = new Error('station_id and connector_type are required'); e.status = 400; throw e;
  }
  const id = uuidv4();
  const res = await query(
    `INSERT INTO chargers (id, asset_id, station_id, connector_type, power_rating, ocpp_id, status, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW()) RETURNING *`,
    [id, asset_id, station_id, connector_type, power_rating, ocpp_id, status]
  );
  return res.rows[0];
};

const update = async (id, data) => {
  const allowed = ['asset_id', 'station_id', 'connector_type', 'power_rating', 'ocpp_id', 'status'];
  const fields = []; const params = []; let idx = 1;
  for (const f of allowed) {
    if (data[f] !== undefined) { fields.push(`${f} = $${idx++}`); params.push(data[f]); }
  }
  if (!fields.length) { const e = new Error('No valid fields to update'); e.status = 400; throw e; }
  fields.push('updated_at = NOW()');
  params.push(id);
  const res = await query(`UPDATE chargers SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, params);
  if (!res.rows[0]) { const e = new Error('Charger not found'); e.status = 404; throw e; }
  return res.rows[0];
};

const remove = async (id) => {
  const res = await query('DELETE FROM chargers WHERE id = $1 RETURNING id', [id]);
  if (!res.rows[0]) { const e = new Error('Charger not found'); e.status = 404; throw e; }
};

const heartbeat = async (id) => {
  const res = await query(
    `UPDATE chargers SET last_heartbeat = NOW(), updated_at = NOW() WHERE id = $1 RETURNING id, status, last_heartbeat`,
    [id]
  );
  if (!res.rows[0]) { const e = new Error('Charger not found'); e.status = 404; throw e; }
  return res.rows[0];
};

const updateStatus = async (id, status) => {
  const valid = ['available', 'charging', 'fault', 'offline'];
  if (!valid.includes(status)) { const e = new Error(`status must be one of: ${valid.join(', ')}`); e.status = 400; throw e; }
  const res = await query(
    `UPDATE chargers SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [status, id]
  );
  if (!res.rows[0]) { const e = new Error('Charger not found'); e.status = 404; throw e; }
  return res.rows[0];
};

const remoteStart = async (chargerId, userId, stationId) => {
  const chargerRes = await query(
    `SELECT c.*, s.electricity_rate, s.selling_rate
     FROM chargers c JOIN stations s ON s.id = c.station_id WHERE c.id = $1`,
    [chargerId]
  );
  const charger = chargerRes.rows[0];
  if (!charger) { const e = new Error('Charger not found'); e.status = 404; throw e; }
  if (charger.status !== 'available') {
    const e = new Error(`Charger is currently ${charger.status}`); e.status = 409; throw e;
  }

  const sid = stationId || charger.station_id;
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const sessionId = uuidv4();
    const sessionRes = await client.query(
      `INSERT INTO charging_sessions (id, charger_id, station_id, user_ref, start_time, status, created_at)
       VALUES ($1,$2,$3,$4,NOW(),'active',NOW()) RETURNING *`,
      [sessionId, chargerId, sid, userId || null]
    );
    await client.query(
      `UPDATE chargers SET status='charging', updated_at=NOW() WHERE id=$1`,
      [chargerId]
    );
    await client.query('COMMIT');
    return sessionRes.rows[0];
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

const remoteStop = async (chargerId) => {
  const chargerRes = await query(
    `SELECT c.*, s.electricity_rate, s.selling_rate
     FROM chargers c JOIN stations s ON s.id = c.station_id WHERE c.id = $1`,
    [chargerId]
  );
  const charger = chargerRes.rows[0];
  if (!charger) { const e = new Error('Charger not found'); e.status = 404; throw e; }

  const sessionRes = await query(
    `SELECT * FROM charging_sessions WHERE charger_id = $1 AND status = 'active' ORDER BY start_time DESC LIMIT 1`,
    [chargerId]
  );
  const session = sessionRes.rows[0];
  if (!session) { const e = new Error('No active session for this charger'); e.status = 404; throw e; }

  const endTime = new Date();
  const durationHours = (endTime - new Date(session.start_time)) / 3600000;
  const energyKwh = parseFloat((durationHours * 7.2).toFixed(4));
  const revenue = parseFloat((energyKwh * parseFloat(charger.selling_rate)).toFixed(2));
  const electricityCost = parseFloat((energyKwh * parseFloat(charger.electricity_rate)).toFixed(2));
  const margin = parseFloat((revenue - electricityCost).toFixed(2));
  const sessionDate = session.start_time.toISOString().split('T')[0];

  const client = await getClient();
  try {
    await client.query('BEGIN');
    const updated = await client.query(
      `UPDATE charging_sessions
       SET end_time=NOW(), energy_kwh=$1, revenue=$2, electricity_cost=$3, margin=$4, status='completed'
       WHERE id=$5 RETURNING *`,
      [energyKwh, revenue, electricityCost, margin, session.id]
    );
    await client.query(`UPDATE chargers SET status='available', updated_at=NOW() WHERE id=$1`, [chargerId]);
    await client.query(
      `INSERT INTO revenues (id, station_id, date, charging_revenue, total_revenue, electricity_cost, gross_margin, energy_consumed, session_count, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$4,$5,$6,$7,1,NOW(),NOW())
       ON CONFLICT (station_id, date) DO UPDATE SET
         charging_revenue = revenues.charging_revenue + EXCLUDED.charging_revenue,
         total_revenue    = revenues.total_revenue    + EXCLUDED.total_revenue,
         electricity_cost = revenues.electricity_cost + EXCLUDED.electricity_cost,
         gross_margin     = revenues.gross_margin     + EXCLUDED.gross_margin,
         energy_consumed  = revenues.energy_consumed  + EXCLUDED.energy_consumed,
         session_count    = revenues.session_count    + 1,
         updated_at       = NOW()`,
      [uuidv4(), charger.station_id, sessionDate, revenue, electricityCost, margin, energyKwh]
    );
    await client.query('COMMIT');
    return updated.rows[0];
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

module.exports = { list, getOne, create, update, remove, heartbeat, updateStatus, remoteStart, remoteStop };
