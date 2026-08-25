'use strict';

const { query, getClient } = require('../../config/database');
const { v4: uuidv4 } = require('uuid');
const { paginate, paginatedResponse } = require('../../utils/pagination');

const itemAmount = (it) => {
  const qty = parseFloat(it.qty) || 0;
  const unitRate = it.unit_rate !== undefined && it.unit_rate !== null && it.unit_rate !== ''
    ? parseFloat(it.unit_rate)
    : (parseFloat(it.supply_rate) || 0) + (parseFloat(it.installation_rate) || 0);
  return { unitRate, amount: qty * unitRate };
};

const list = async (filters) => {
  const { page, limit, skip } = paginate(filters);
  const conditions = [];
  const params = [];
  let idx = 1;

  if (filters.project_id) { conditions.push(`b.project_id = $${idx++}`); params.push(filters.project_id); }
  if (filters.status)     { conditions.push(`b.status = $${idx++}`);     params.push(filters.status); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRes = await query(`SELECT COUNT(*) FROM nakjm_boqs b ${where}`, params);
  const total = parseInt(countRes.rows[0].count, 10);

  const dataRes = await query(
    `SELECT b.*, p.name AS project_name FROM nakjm_boqs b
     LEFT JOIN nakjm_projects p ON p.id = b.project_id
     ${where} ORDER BY b.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, skip]
  );

  return paginatedResponse(dataRes.rows, total, page, limit);
};

const getOne = async (id) => {
  const res = await query(
    `SELECT b.*, p.name AS project_name FROM nakjm_boqs b
     LEFT JOIN nakjm_projects p ON p.id = b.project_id WHERE b.id = $1`,
    [id]
  );
  if (!res.rows[0]) { const e = new Error('BOQ not found'); e.status = 404; throw e; }
  const itemsRes = await query('SELECT * FROM nakjm_boq_items WHERE boq_id = $1 ORDER BY sr_no', [id]);
  return { ...res.rows[0], items: itemsRes.rows };
};

const create = async (data) => {
  const {
    boq_no, project_id, quotation_id = null, site_name = null, version = 1, status = 'draft',
    boq_date = null, notes = null, source_document_id = null, items = [],
  } = data;
  if (!boq_no || !project_id) { const e = new Error('boq_no and project_id are required'); e.status = 400; throw e; }

  const total = items.reduce((s, it) => s + itemAmount(it).amount, 0);

  const client = await getClient();
  try {
    await client.query('BEGIN');
    const id = uuidv4();
    await client.query(
      `INSERT INTO nakjm_boqs (id, boq_no, project_id, quotation_id, site_name, version, status, boq_date, total_amount, notes, source_document_id, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8,CURRENT_DATE),$9,$10,$11,NOW(),NOW())`,
      [id, boq_no, project_id, quotation_id, site_name, version, status, boq_date, total.toFixed(2), notes, source_document_id]
    );
    for (const [i, it] of items.entries()) {
      const { unitRate, amount } = itemAmount(it);
      await client.query(
        `INSERT INTO nakjm_boq_items (id, boq_id, section, sr_no, description, make_oem, unit, qty, supply_rate, installation_rate, unit_rate, amount, category, remarks)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [uuidv4(), id, it.section || null, it.sr_no || i + 1, it.description, it.make_oem || null, it.unit || null,
          it.qty || 0, it.supply_rate || 0, it.installation_rate || 0, unitRate, amount, it.category || 'other', it.remarks || null]
      );
    }
    await client.query('COMMIT');
    return getOne(id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const update = async (id, data) => {
  if (data.items) {
    const total = data.items.reduce((s, it) => s + itemAmount(it).amount, 0);
    const client = await getClient();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM nakjm_boq_items WHERE boq_id = $1', [id]);
      for (const [i, it] of data.items.entries()) {
        const { unitRate, amount } = itemAmount(it);
        await client.query(
          `INSERT INTO nakjm_boq_items (id, boq_id, section, sr_no, description, make_oem, unit, qty, supply_rate, installation_rate, unit_rate, amount, category, remarks)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
          [uuidv4(), id, it.section || null, it.sr_no || i + 1, it.description, it.make_oem || null, it.unit || null,
            it.qty || 0, it.supply_rate || 0, it.installation_rate || 0, unitRate, amount, it.category || 'other', it.remarks || null]
        );
      }
      await client.query('UPDATE nakjm_boqs SET total_amount=$1, updated_at=NOW() WHERE id=$2', [total.toFixed(2), id]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  const allowed = ['status', 'version', 'site_name', 'boq_date', 'notes'];
  const fields = []; const params = []; let idx = 1;
  for (const f of allowed) {
    if (data[f] !== undefined) { fields.push(`${f} = $${idx++}`); params.push(data[f]); }
  }
  if (fields.length) {
    fields.push('updated_at = NOW()');
    params.push(id);
    const res = await query(`UPDATE nakjm_boqs SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id`, params);
    if (!res.rows[0]) { const e = new Error('BOQ not found'); e.status = 404; throw e; }
  }
  return getOne(id);
};

const remove = async (id) => {
  const res = await query('DELETE FROM nakjm_boqs WHERE id = $1 RETURNING id', [id]);
  if (!res.rows[0]) { const e = new Error('BOQ not found'); e.status = 404; throw e; }
};

module.exports = { list, getOne, create, update, remove };
