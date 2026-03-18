'use strict';

const { query } = require('../../config/database');
const { v4: uuidv4 } = require('uuid');

async function listAssets({ station_id, asset_type, ownership, franchise_id }) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (station_id) { conditions.push(`a.station_id = $${idx++}`); params.push(station_id); }
  if (asset_type) { conditions.push(`a.asset_type = $${idx++}`); params.push(asset_type); }
  if (ownership) { conditions.push(`a.ownership = $${idx++}`); params.push(ownership); }
  if (franchise_id) { conditions.push(`a.franchise_id = $${idx++}`); params.push(franchise_id); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `SELECT a.*, s.name AS station_name, f.name AS franchise_name
     FROM assets a
     LEFT JOIN stations s ON s.id = a.station_id
     LEFT JOIN franchises f ON f.id = a.franchise_id
     ${where}
     ORDER BY a.created_at DESC`,
    params
  );
  return result.rows;
}

async function getAssetById(id) {
  const result = await query(
    `SELECT a.*, s.name AS station_name, f.name AS franchise_name
     FROM assets a
     LEFT JOIN stations s ON s.id = a.station_id
     LEFT JOIN franchises f ON f.id = a.franchise_id
     WHERE a.id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function createAsset(data) {
  const id = uuidv4();
  const {
    station_id, asset_type, name, capacity, oem,
    installed_by = 'company', ownership = 'company',
    franchise_id = null, commission_date = null, status = 'active',
  } = data;

  const result = await query(
    `INSERT INTO assets
      (id, station_id, asset_type, name, capacity, oem, installed_by, ownership, franchise_id, commission_date, status, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW())
     RETURNING *`,
    [id, station_id, asset_type, name, capacity || null, oem || null, installed_by, ownership, franchise_id, commission_date, status]
  );
  return result.rows[0];
}

async function updateAsset(id, data) {
  const allowed = ['station_id', 'asset_type', 'name', 'capacity', 'oem', 'installed_by', 'ownership', 'franchise_id', 'commission_date', 'status'];
  const fields = [];
  const params = [];
  let idx = 1;

  for (const field of allowed) {
    if (data[field] !== undefined) {
      fields.push(`${field} = $${idx++}`);
      params.push(data[field]);
    }
  }

  if (fields.length === 0) return null;

  fields.push(`updated_at = NOW()`);
  params.push(id);

  const result = await query(
    `UPDATE assets SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    params
  );
  return result.rows[0] || null;
}

async function deleteAsset(id) {
  const result = await query('DELETE FROM assets WHERE id = $1 RETURNING id', [id]);
  return result.rows.length > 0;
}

module.exports = { listAssets, getAssetById, createAsset, updateAsset, deleteAsset };
