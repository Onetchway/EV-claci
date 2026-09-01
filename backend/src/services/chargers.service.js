'use strict';

const { query, getClient } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { paginate, paginatedResponse } = require('../utils/pagination');
const { tenantWhere, tenantIdForInsert } = require('../middleware/tenantScope');

const list = async (filters, req) => {
  const { page, limit, skip } = paginate(filters);
  const conditions = [];
  const params = [];
  let idx = 1;

  const tenant = tenantWhere(req, idx);
  if (tenant.clause) { conditions.push(tenant.clause.replace('tenant_id', 'c.tenant_id')); params.push(...tenant.params); idx += tenant.params.length; }

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

const getOne = async (id, req) => {
  const conditions = ['c.id = $1'];
  const params = [id];
  const tenant = tenantWhere(req, 2);
  if (tenant.clause) { conditions.push(tenant.clause.replace('tenant_id', 'c.tenant_id')); params.push(...tenant.params); }

  const res = await query(
    `SELECT c.*, s.name AS station_name, s.electricity_rate, s.selling_rate
     FROM chargers c
     JOIN stations s ON s.id = c.station_id
     WHERE ${conditions.join(' AND ')}`,
    params
  );
  if (!res.rows[0]) { const e = new Error('Charger not found'); e.status = 404; throw e; }
  const sessions = await query(
    `SELECT * FROM charging_sessions WHERE charger_id = $1 ORDER BY created_at DESC LIMIT 10`,
    [id]
  );
  return { ...res.rows[0], recent_sessions: sessions.rows };
};

const create = async (data, req) => {
  const { asset_id = null, station_id, connector_type, power_rating = 0, ocpp_id = null, status = 'available' } = data;
  if (!station_id || !connector_type) {
    const e = new Error('station_id and connector_type are required'); e.status = 400; throw e;
  }
  const id = uuidv4();
  const res = await query(
    `INSERT INTO chargers (id, tenant_id, asset_id, station_id, connector_type, power_rating, ocpp_id, status, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW()) RETURNING *`,
    [id, tenantIdForInsert(req), asset_id, station_id, connector_type, power_rating, ocpp_id, status]
  );
  return res.rows[0];
};

const update = async (id, data, req) => {
  const allowed = ['asset_id', 'station_id', 'connector_type', 'power_rating', 'ocpp_id', 'status'];
  const fields = []; const params = []; let idx = 1;
  for (const f of allowed) {
    if (data[f] !== undefined) { fields.push(`${f} = $${idx++}`); params.push(data[f]); }
  }
  if (!fields.length) { const e = new Error('No valid fields to update'); e.status = 400; throw e; }
  fields.push('updated_at = NOW()');
  params.push(id);
  let sql = `UPDATE chargers SET ${fields.join(', ')} WHERE id = $${idx}`;
  const tenant = tenantWhere(req, idx + 1);
  if (tenant.clause) { sql += ` AND ${tenant.clause}`; params.push(...tenant.params); }
  const res = await query(`${sql} RETURNING *`, params);
  if (!res.rows[0]) { const e = new Error('Charger not found'); e.status = 404; throw e; }
  return res.rows[0];
};

const remove = async (id, req) => {
  let sql = 'DELETE FROM chargers WHERE id = $1';
  const params = [id];
  const tenant = tenantWhere(req, 2);
  if (tenant.clause) { sql += ` AND ${tenant.clause}`; params.push(...tenant.params); }
  const res = await query(`${sql} RETURNING id`, params);
  if (!res.rows[0]) { const e = new Error('Charger not found'); e.status = 404; throw e; }
};

const heartbeat = async (id, req) => {
  let sql = 'UPDATE chargers SET last_heartbeat = NOW(), updated_at = NOW() WHERE id = $1';
  const params = [id];
  const tenant = tenantWhere(req, 2);
  if (tenant.clause) { sql += ` AND ${tenant.clause}`; params.push(...tenant.params); }
  const res = await query(`${sql} RETURNING id, status, last_heartbeat`, params);
  if (!res.rows[0]) { const e = new Error('Charger not found'); e.status = 404; throw e; }
  return res.rows[0];
};

const updateStatus = async (id, status, req) => {
  const valid = ['available', 'charging', 'fault', 'offline'];
  if (!valid.includes(status)) { const e = new Error(`status must be one of: ${valid.join(', ')}`); e.status = 400; throw e; }
  let sql = `UPDATE chargers SET status = $1, updated_at = NOW() WHERE id = $2`;
  const params = [status, id];
  const tenant = tenantWhere(req, 3);
  if (tenant.clause) { sql += ` AND ${tenant.clause}`; params.push(...tenant.params); }
  const res = await query(`${sql} RETURNING *`, params);
  if (!res.rows[0]) { const e = new Error('Charger not found'); e.status = 404; throw e; }
  return res.rows[0];
};

const remoteStart = async (chargerId, userId, stationId, req) => {
  const conditions = ['c.id = $1'];
  const params = [chargerId];
  const cTenant = tenantWhere(req, 2);
  if (cTenant.clause) { conditions.push(cTenant.clause.replace('tenant_id', 'c.tenant_id')); params.push(...cTenant.params); }
  const chargerRes = await query(
    `SELECT c.*, s.electricity_rate, s.selling_rate
     FROM chargers c JOIN stations s ON s.id = c.station_id WHERE ${conditions.join(' AND ')}`,
    params
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
      `INSERT INTO charging_sessions (id, tenant_id, charger_id, station_id, user_ref, start_time, status, created_at)
       VALUES ($1,$2,$3,$4,$5,NOW(),'active',NOW()) RETURNING *`,
      [sessionId, tenantIdForInsert(req), chargerId, sid, userId || null]
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

const remoteStop = async (chargerId, req) => {
  const conditions = ['c.id = $1'];
  const params = [chargerId];
  const cTenant = tenantWhere(req, 2);
  if (cTenant.clause) { conditions.push(cTenant.clause.replace('tenant_id', 'c.tenant_id')); params.push(...cTenant.params); }
  const chargerRes = await query(
    `SELECT c.*, s.electricity_rate, s.selling_rate
     FROM chargers c JOIN stations s ON s.id = c.station_id WHERE ${conditions.join(' AND ')}`,
    params
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
      `INSERT INTO revenues (id, tenant_id, station_id, date, charging_revenue, total_revenue, electricity_cost, gross_margin, energy_consumed, session_count, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$5,$6,$7,$8,1,NOW(),NOW())
       ON CONFLICT (station_id, date) DO UPDATE SET
         charging_revenue = revenues.charging_revenue + EXCLUDED.charging_revenue,
         total_revenue    = revenues.total_revenue    + EXCLUDED.total_revenue,
         electricity_cost = revenues.electricity_cost + EXCLUDED.electricity_cost,
         gross_margin     = revenues.gross_margin     + EXCLUDED.gross_margin,
         energy_consumed  = revenues.energy_consumed  + EXCLUDED.energy_consumed,
         session_count    = revenues.session_count    + 1,
         updated_at       = NOW()`,
      [uuidv4(), tenantIdForInsert(req), charger.station_id, sessionDate, revenue, electricityCost, margin, energyKwh]
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
