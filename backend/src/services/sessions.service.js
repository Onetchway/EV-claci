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
  if (tenant.clause) { conditions.push(tenant.clause.replace('tenant_id', 'cs.tenant_id')); params.push(...tenant.params); idx += tenant.params.length; }

  if (filters.station_id) { conditions.push(`cs.station_id = $${idx++}`); params.push(filters.station_id); }
  if (filters.stationId)  { conditions.push(`cs.station_id = $${idx++}`); params.push(filters.stationId); }
  if (filters.charger_id) { conditions.push(`cs.charger_id = $${idx++}`); params.push(filters.charger_id); }
  if (filters.chargerId)  { conditions.push(`cs.charger_id = $${idx++}`); params.push(filters.chargerId); }
  if (filters.status)     { conditions.push(`cs.status = $${idx++}`);     params.push(filters.status); }
  if (filters.user_ref)   { conditions.push(`cs.user_ref = $${idx++}`);   params.push(filters.user_ref); }
  if (filters.from && filters.to) {
    conditions.push(`cs.start_time BETWEEN $${idx++} AND $${idx++}`); params.push(filters.from, filters.to);
  } else if (filters.from) { conditions.push(`cs.start_time >= $${idx++}`); params.push(filters.from); }
  else if (filters.to)     { conditions.push(`cs.start_time <= $${idx++}`); params.push(filters.to); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRes = await query(`SELECT COUNT(*) FROM charging_sessions cs ${where}`, params);
  const total = parseInt(countRes.rows[0].count, 10);

  const dataRes = await query(
    `SELECT cs.*,
      c.connector_type, c.power_rating,
      s.name AS station_name, s.city AS station_city
     FROM charging_sessions cs
     LEFT JOIN chargers c ON c.id = cs.charger_id
     LEFT JOIN stations s ON s.id = cs.station_id
     ${where}
     ORDER BY cs.start_time DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, skip]
  );

  return paginatedResponse(dataRes.rows, total, page, limit);
};

const getOne = async (id, req) => {
  const conditions = ['cs.id = $1'];
  const params = [id];
  const tenant = tenantWhere(req, 2);
  if (tenant.clause) { conditions.push(tenant.clause.replace('tenant_id', 'cs.tenant_id')); params.push(...tenant.params); }

  const res = await query(
    `SELECT cs.*,
      c.connector_type, c.power_rating, c.ocpp_id,
      s.name AS station_name, s.city AS station_city, s.address AS station_address
     FROM charging_sessions cs
     LEFT JOIN chargers c ON c.id = cs.charger_id
     LEFT JOIN stations s ON s.id = cs.station_id
     WHERE ${conditions.join(' AND ')}`,
    params
  );
  if (!res.rows[0]) { const e = new Error('Session not found'); e.status = 404; throw e; }
  return res.rows[0];
};

const create = async ({ charger_id, station_id, user_ref = null }, req) => {
  if (!charger_id || !station_id) {
    const e = new Error('charger_id and station_id are required'); e.status = 400; throw e;
  }
  const chargerConditions = ['id = $1']; const chargerParams = [charger_id];
  const chargerTenant = tenantWhere(req, 2);
  if (chargerTenant.clause) { chargerConditions.push(chargerTenant.clause); chargerParams.push(...chargerTenant.params); }
  const chargerRes = await query(`SELECT * FROM chargers WHERE ${chargerConditions.join(' AND ')}`, chargerParams);
  const charger = chargerRes.rows[0];
  if (!charger) { const e = new Error('Charger not found'); e.status = 404; throw e; }
  if (charger.status !== 'available') {
    const e = new Error(`Charger is not available (current status: ${charger.status})`); e.status = 409; throw e;
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');
    const sessionId = uuidv4();
    const sessionRes = await client.query(
      `INSERT INTO charging_sessions (id, tenant_id, charger_id, station_id, user_ref, start_time, status, created_at)
       VALUES ($1,$2,$3,$4,$5,NOW(),'active',NOW()) RETURNING *`,
      [sessionId, tenantIdForInsert(req), charger_id, station_id, user_ref]
    );
    await client.query(`UPDATE chargers SET status='charging', updated_at=NOW() WHERE id=$1`, [charger_id]);
    await client.query('COMMIT');
    return sessionRes.rows[0];
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

const endSession = async (id, { energy_kwh, revenue } = {}, req) => {
  const sessConditions = ['cs.id = $1']; const sessParams = [id];
  const sessTenant = tenantWhere(req, 2);
  if (sessTenant.clause) { sessConditions.push(sessTenant.clause.replace('tenant_id', 'cs.tenant_id')); sessParams.push(...sessTenant.params); }
  const sessionRes = await query(
    `SELECT cs.*, s.selling_rate, s.electricity_rate
     FROM charging_sessions cs
     JOIN stations s ON s.id = cs.station_id
     WHERE ${sessConditions.join(' AND ')}`,
    sessParams
  );
  const session = sessionRes.rows[0];
  if (!session) { const e = new Error('Session not found'); e.status = 404; throw e; }
  if (session.status !== 'active') {
    const e = new Error(`Session is not active (current status: ${session.status})`); e.status = 409; throw e;
  }

  let kwh = energy_kwh;
  if (!kwh) {
    const hours = (new Date() - new Date(session.start_time)) / 3600000;
    kwh = parseFloat((hours * 7.2).toFixed(4));
  }
  const rev = revenue || parseFloat((kwh * parseFloat(session.selling_rate)).toFixed(2));
  const cost = parseFloat((kwh * parseFloat(session.electricity_rate)).toFixed(2));
  const margin = parseFloat((rev - cost).toFixed(2));
  const sessionDate = session.start_time.toISOString().split('T')[0];

  const client = await getClient();
  try {
    await client.query('BEGIN');
    const updated = await client.query(
      `UPDATE charging_sessions
       SET end_time=NOW(), energy_kwh=$1, revenue=$2, electricity_cost=$3, margin=$4, status='completed'
       WHERE id=$5 RETURNING *`,
      [kwh, rev, cost, margin, id]
    );
    await client.query(`UPDATE chargers SET status='available', updated_at=NOW() WHERE id=$1`, [session.charger_id]);
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
      [uuidv4(), tenantIdForInsert(req), session.station_id, sessionDate, rev, cost, margin, kwh]
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

// Export sessions as array of plain objects for CSV
const exportForCsv = async (filters, req) => {
  const conditions = [];
  const params = [];
  let idx = 1;

  const tenant = tenantWhere(req, idx);
  if (tenant.clause) { conditions.push(tenant.clause.replace('tenant_id', 'cs.tenant_id')); params.push(...tenant.params); idx += tenant.params.length; }

  if (filters.station_id) { conditions.push(`cs.station_id = $${idx++}`); params.push(filters.station_id); }
  if (filters.from && filters.to) { conditions.push(`cs.start_time BETWEEN $${idx++} AND $${idx++}`); params.push(filters.from, filters.to); }
  else if (filters.from) { conditions.push(`cs.start_time >= $${idx++}`); params.push(filters.from); }
  else if (filters.to)   { conditions.push(`cs.start_time <= $${idx++}`); params.push(filters.to); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const res = await query(
    `SELECT
      cs.id, cs.user_ref, cs.start_time, cs.end_time, cs.energy_kwh,
      cs.revenue, cs.electricity_cost, cs.margin, cs.status,
      c.connector_type, c.ocpp_id,
      s.name AS station_name, s.city, s.state
     FROM charging_sessions cs
     LEFT JOIN chargers c ON c.id = cs.charger_id
     LEFT JOIN stations s ON s.id = cs.station_id
     ${where}
     ORDER BY cs.start_time DESC`,
    params
  );
  return res.rows;
};

module.exports = { list, getOne, create, endSession, exportForCsv };
