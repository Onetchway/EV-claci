'use strict';

const { query } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { paginate, paginatedResponse } = require('../utils/pagination');

const list = async (filters) => {
  const { page, limit, skip } = paginate(filters);
  const conditions = [];
  const params = [];
  let idx = 1;

  if (filters.station_id)   { conditions.push(`a.station_id   = $${idx++}`); params.push(filters.station_id); }
  if (filters.stationId)    { conditions.push(`a.station_id   = $${idx++}`); params.push(filters.stationId); }
  if (filters.asset_type)   { conditions.push(`a.asset_type   = $${idx++}`); params.push(filters.asset_type); }
  if (filters.assetType)    { conditions.push(`a.asset_type   = $${idx++}`); params.push(filters.assetType); }
  if (filters.ownership)    { conditions.push(`a.ownership    = $${idx++}`); params.push(filters.ownership); }
  if (filters.franchise_id) { conditions.push(`a.franchise_id = $${idx++}`); params.push(filters.franchise_id); }
  if (filters.franchiseId)  { conditions.push(`a.franchise_id = $${idx++}`); params.push(filters.franchiseId); }
  if (filters.status)       { conditions.push(`a.status       = $${idx++}`); params.push(filters.status); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRes = await query(`SELECT COUNT(*) FROM assets a ${where}`, params);
  const total = parseInt(countRes.rows[0].count, 10);

  const dataRes = await query(
    `SELECT a.*, s.name AS station_name, f.name AS franchise_name
     FROM assets a
     LEFT JOIN stations   s ON s.id = a.station_id
     LEFT JOIN franchises f ON f.id = a.franchise_id
     ${where}
     ORDER BY a.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, skip]
  );

  return paginatedResponse(dataRes.rows, total, page, limit);
};

const getOne = async (id) => {
  const res = await query(
    `SELECT a.*, s.name AS station_name, f.name AS franchise_name
     FROM assets a
     LEFT JOIN stations   s ON s.id = a.station_id
     LEFT JOIN franchises f ON f.id = a.franchise_id
     WHERE a.id = $1`,
    [id]
  );
  if (!res.rows[0]) { const e = new Error('Asset not found'); e.status = 404; throw e; }
  return res.rows[0];
};

const create = async (data) => {
  const {
    station_id, asset_type, name, capacity = null, oem = null,
    installed_by = 'company', ownership = 'company',
    franchise_id = null, commission_date = null, status = 'active',
  } = data;
  if (!station_id || !asset_type || !name) {
    const e = new Error('station_id, asset_type, and name are required'); e.status = 400; throw e;
  }
  const id = uuidv4();
  const res = await query(
    `INSERT INTO assets (id, station_id, asset_type, name, capacity, oem, installed_by, ownership, franchise_id, commission_date, status, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW()) RETURNING *`,
    [id, station_id, asset_type, name, capacity, oem, installed_by, ownership, franchise_id, commission_date, status]
  );
  return res.rows[0];
};

const update = async (id, data) => {
  const allowed = ['station_id', 'asset_type', 'name', 'capacity', 'oem', 'installed_by', 'ownership', 'franchise_id', 'commission_date', 'status'];
  const fields = []; const params = []; let idx = 1;
  for (const f of allowed) {
    if (data[f] !== undefined) { fields.push(`${f} = $${idx++}`); params.push(data[f]); }
  }
  if (!fields.length) { const e = new Error('No valid fields to update'); e.status = 400; throw e; }
  fields.push('updated_at = NOW()');
  params.push(id);
  const res = await query(`UPDATE assets SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, params);
  if (!res.rows[0]) { const e = new Error('Asset not found'); e.status = 404; throw e; }
  return res.rows[0];
};

const remove = async (id) => {
  const res = await query('DELETE FROM assets WHERE id = $1 RETURNING id', [id]);
  if (!res.rows[0]) { const e = new Error('Asset not found'); e.status = 404; throw e; }
};

module.exports = { list, getOne, create, update, remove };
