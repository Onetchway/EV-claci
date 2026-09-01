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
  if (tenant.clause) { conditions.push(tenant.clause.replace('tenant_id', 'b.tenant_id')); params.push(...tenant.params); idx += tenant.params.length; }

  if (filters.station_id) { conditions.push(`b.station_id = $${idx++}`); params.push(filters.station_id); }
  if (filters.stationId)  { conditions.push(`b.station_id = $${idx++}`); params.push(filters.stationId); }
  if (filters.status)     { conditions.push(`b.status = $${idx++}`);     params.push(filters.status); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRes = await query(`SELECT COUNT(*) FROM bss_stations b ${where}`, params);
  const total = parseInt(countRes.rows[0].count, 10);

  const dataRes = await query(
    `SELECT b.*, s.name AS station_name
     FROM bss_stations b
     JOIN stations s ON s.id = b.station_id
     ${where}
     ORDER BY b.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, skip]
  );

  return paginatedResponse(dataRes.rows, total, page, limit);
};

const getOne = async (id, req) => {
  const conditions = ['b.id = $1'];
  const params = [id];
  const tenant = tenantWhere(req, 2);
  if (tenant.clause) { conditions.push(tenant.clause.replace('tenant_id', 'b.tenant_id')); params.push(...tenant.params); }

  const res = await query(
    `SELECT b.*, s.name AS station_name
     FROM bss_stations b
     JOIN stations s ON s.id = b.station_id
     WHERE ${conditions.join(' AND ')}`,
    params
  );
  if (!res.rows[0]) { const e = new Error('BSS station not found'); e.status = 404; throw e; }

  const statsRes = await query(
    `SELECT
      COUNT(*) FILTER (WHERE swap_type='swap')         AS total_swaps,
      COUNT(*) FILTER (WHERE swap_type='rental_start') AS total_rentals,
      COALESCE(SUM(amount),0)                          AS total_revenue
     FROM bss_swaps WHERE bss_station_id = $1`,
    [id]
  );
  return { ...res.rows[0], stats: statsRes.rows[0] };
};

const create = async (data, req) => {
  const {
    asset_id = null, station_id, number_of_batteries = 0, battery_type = null,
    swap_price = 0, rental_price_daily = 0, rental_price_monthly = 0, status = 'active',
  } = data;
  if (!station_id) { const e = new Error('station_id is required'); e.status = 400; throw e; }
  const id = uuidv4();
  const res = await query(
    `INSERT INTO bss_stations (id, tenant_id, asset_id, station_id, number_of_batteries, battery_type, swap_price, rental_price_daily, rental_price_monthly, status, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW()) RETURNING *`,
    [id, tenantIdForInsert(req), asset_id, station_id, number_of_batteries, battery_type, swap_price, rental_price_daily, rental_price_monthly, status]
  );
  return res.rows[0];
};

const update = async (id, data, req) => {
  const allowed = ['asset_id', 'station_id', 'number_of_batteries', 'battery_type', 'swap_price', 'rental_price_daily', 'rental_price_monthly', 'status'];
  const fields = []; const params = []; let idx = 1;
  for (const f of allowed) {
    if (data[f] !== undefined) { fields.push(`${f} = $${idx++}`); params.push(data[f]); }
  }
  if (!fields.length) { const e = new Error('No valid fields to update'); e.status = 400; throw e; }
  fields.push('updated_at = NOW()');
  params.push(id);
  let sql = `UPDATE bss_stations SET ${fields.join(', ')} WHERE id = $${idx}`;
  const tenant = tenantWhere(req, idx + 1);
  if (tenant.clause) { sql += ` AND ${tenant.clause}`; params.push(...tenant.params); }
  const res = await query(`${sql} RETURNING *`, params);
  if (!res.rows[0]) { const e = new Error('BSS station not found'); e.status = 404; throw e; }
  return res.rows[0];
};

const remove = async (id, req) => {
  let sql = 'DELETE FROM bss_stations WHERE id = $1';
  const params = [id];
  const tenant = tenantWhere(req, 2);
  if (tenant.clause) { sql += ` AND ${tenant.clause}`; params.push(...tenant.params); }
  const res = await query(`${sql} RETURNING id`, params);
  if (!res.rows[0]) { const e = new Error('BSS station not found'); e.status = 404; throw e; }
};

const recordUsage = async (bssId, { swap_type, rental_days = null }, req) => {
  const validTypes = ['swap', 'rental_start', 'rental_end'];
  if (!swap_type || !validTypes.includes(swap_type)) {
    const e = new Error(`swap_type must be one of: ${validTypes.join(', ')}`); e.status = 400; throw e;
  }

  const bssConditions = ['id = $1']; const bssParams = [bssId];
  const bssTenant = tenantWhere(req, 2);
  if (bssTenant.clause) { bssConditions.push(bssTenant.clause); bssParams.push(...bssTenant.params); }
  const bssRes = await query(`SELECT * FROM bss_stations WHERE ${bssConditions.join(' AND ')}`, bssParams);
  const bss = bssRes.rows[0];
  if (!bss) { const e = new Error('BSS station not found'); e.status = 404; throw e; }

  let amount = 0;
  if (swap_type === 'swap') {
    amount = parseFloat(bss.swap_price);
  } else if (swap_type === 'rental_start' && rental_days) {
    amount = parseFloat(bss.rental_price_daily) * parseInt(rental_days);
  } else if (swap_type === 'rental_start') {
    amount = parseFloat(bss.rental_price_daily);
  }

  const today = new Date().toISOString().split('T')[0];
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const swapId = uuidv4();
    const swapRes = await client.query(
      `INSERT INTO bss_swaps (id, tenant_id, bss_station_id, station_id, swap_type, amount, swap_date, rental_days, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW()) RETURNING *`,
      [swapId, tenantIdForInsert(req), bss.id, bss.station_id, swap_type, amount, today, rental_days]
    );

    if (amount > 0) {
      const isRental = swap_type === 'rental_start';
      await client.query(
        `INSERT INTO revenues (id, tenant_id, station_id, date, bss_swap_revenue, bss_rental_revenue, total_revenue, electricity_cost, gross_margin, energy_consumed, session_count, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,0,$7,0,0,NOW(),NOW())
         ON CONFLICT (station_id, date) DO UPDATE SET
           bss_swap_revenue   = revenues.bss_swap_revenue   + $5,
           bss_rental_revenue = revenues.bss_rental_revenue + $6,
           total_revenue      = revenues.total_revenue      + $7,
           gross_margin       = revenues.gross_margin       + $7,
           updated_at         = NOW()`,
        [uuidv4(), tenantIdForInsert(req), bss.station_id, today, isRental ? 0 : amount, isRental ? amount : 0, amount]
      );
    }

    await client.query('COMMIT');
    return swapRes.rows[0];
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

const getUsage = async (bssId, filters = {}, req) => {
  const { page, limit, skip } = paginate(filters);
  const bssConditions = ['id = $1']; const bssParams = [bssId];
  const bssTenant = tenantWhere(req, 2);
  if (bssTenant.clause) { bssConditions.push(bssTenant.clause); bssParams.push(...bssTenant.params); }
  const bssRes = await query(`SELECT id FROM bss_stations WHERE ${bssConditions.join(' AND ')}`, bssParams);
  if (!bssRes.rows[0]) { const e = new Error('BSS station not found'); e.status = 404; throw e; }

  const conditions = [`bss_station_id = $1`]; const params = [bssId]; let idx = 2;
  if (filters.start_date && filters.end_date) { conditions.push(`swap_date BETWEEN $${idx++} AND $${idx++}`); params.push(filters.start_date, filters.end_date); }
  else if (filters.start_date) { conditions.push(`swap_date >= $${idx++}`); params.push(filters.start_date); }
  else if (filters.end_date)   { conditions.push(`swap_date <= $${idx++}`); params.push(filters.end_date); }
  const usageTenant = tenantWhere(req, idx);
  if (usageTenant.clause) { conditions.push(usageTenant.clause); params.push(...usageTenant.params); idx += usageTenant.params.length; }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const countRes = await query(`SELECT COUNT(*) FROM bss_swaps ${where}`, params);
  const total = parseInt(countRes.rows[0].count, 10);

  const dataRes = await query(
    `SELECT * FROM bss_swaps ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, skip]
  );

  return paginatedResponse(dataRes.rows, total, page, limit);
};

module.exports = { list, getOne, create, update, remove, recordUsage, getUsage };
