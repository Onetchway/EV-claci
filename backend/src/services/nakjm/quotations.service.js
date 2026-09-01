'use strict';

const { query, getClient } = require('../../config/database');
const { v4: uuidv4 } = require('uuid');
const { paginate, paginatedResponse } = require('../../utils/pagination');
const { tenantWhere, tenantIdForInsert } = require('../../middleware/tenantScope');

const computeTotals = (items, taxPercent) => {
  const subtotal = items.reduce((s, it) => s + (parseFloat(it.qty) || 0) * (parseFloat(it.rate) || 0), 0);
  const taxAmount = parseFloat((subtotal * (parseFloat(taxPercent) || 0) / 100).toFixed(2));
  return { subtotal: parseFloat(subtotal.toFixed(2)), taxAmount, total: parseFloat((subtotal + taxAmount).toFixed(2)) };
};

const list = async (filters, req) => {
  const { page, limit, skip } = paginate(filters);
  const conditions = [];
  const params = [];
  let idx = 1;

  const tenant = tenantWhere(req, idx);
  if (tenant.clause) { conditions.push(tenant.clause.replace('tenant_id', 'q.tenant_id')); params.push(...tenant.params); idx += tenant.params.length; }

  if (filters.project_id) { conditions.push(`q.project_id = $${idx++}`); params.push(filters.project_id); }
  if (filters.client_id)  { conditions.push(`q.client_id = $${idx++}`);  params.push(filters.client_id); }
  if (filters.status)     { conditions.push(`q.status = $${idx++}`);     params.push(filters.status); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRes = await query(`SELECT COUNT(*) FROM nakjm_quotations q ${where}`, params);
  const total = parseInt(countRes.rows[0].count, 10);

  const dataRes = await query(
    `SELECT q.*, p.name AS project_name, c.name AS client_name
     FROM nakjm_quotations q
     LEFT JOIN nakjm_projects p ON p.id = q.project_id
     LEFT JOIN nakjm_clients c ON c.id = q.client_id
     ${where} ORDER BY q.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, skip]
  );

  return paginatedResponse(dataRes.rows, total, page, limit);
};

const getOne = async (id, req) => {
  const conditions = ['q.id = $1'];
  const params = [id];
  const tenant = tenantWhere(req, 2);
  if (tenant.clause) { conditions.push(tenant.clause.replace('tenant_id', 'q.tenant_id')); params.push(...tenant.params); }
  const res = await query(
    `SELECT q.*, p.name AS project_name, c.name AS client_name FROM nakjm_quotations q
     LEFT JOIN nakjm_projects p ON p.id = q.project_id
     LEFT JOIN nakjm_clients c ON c.id = q.client_id
     WHERE ${conditions.join(' AND ')}`,
    params
  );
  if (!res.rows[0]) { const e = new Error('Quotation not found'); e.status = 404; throw e; }
  const itemsRes = await query('SELECT * FROM nakjm_quotation_items WHERE quotation_id = $1 ORDER BY sr_no', [id]);
  return { ...res.rows[0], items: itemsRes.rows };
};

const create = async (data, req) => {
  const {
    quotation_no, project_id, client_id, version = 1, status = 'draft',
    quotation_date = null, valid_until = null, tax_percent = 18, terms = null, notes = null,
    source_boq_id = null, items = [],
  } = data;
  if (!quotation_no || !project_id || !client_id) {
    const e = new Error('quotation_no, project_id, and client_id are required'); e.status = 400; throw e;
  }
  const { subtotal, taxAmount, total } = computeTotals(items, tax_percent);
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const id = uuidv4();
    const res = await client.query(
      `INSERT INTO nakjm_quotations (id, tenant_id, quotation_no, project_id, client_id, version, status, quotation_date, valid_until, subtotal, tax_percent, tax_amount, total_amount, terms, notes, source_boq_id, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8,CURRENT_DATE),$9,$10,$11,$12,$13,$14,$15,$16,NOW(),NOW()) RETURNING *`,
      [id, tenantIdForInsert(req), quotation_no, project_id, client_id, version, status, quotation_date, valid_until, subtotal, tax_percent, taxAmount, total, terms, notes, source_boq_id]
    );
    for (const [i, it] of items.entries()) {
      const amount = (parseFloat(it.qty) || 0) * (parseFloat(it.rate) || 0);
      await client.query(
        `INSERT INTO nakjm_quotation_items (id, quotation_id, sr_no, description, unit, qty, rate, amount, category, remarks)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [uuidv4(), id, it.sr_no || i + 1, it.description, it.unit || null, it.qty || 0, it.rate || 0, amount, it.category || null, it.remarks || null]
      );
    }
    await client.query('COMMIT');
    return getOne(id, req);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const update = async (id, data, req) => {
  if (data.items) {
    const { subtotal, taxAmount, total } = computeTotals(data.items, data.tax_percent ?? 18);
    const client = await getClient();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM nakjm_quotation_items WHERE quotation_id = $1', [id]);
      for (const [i, it] of data.items.entries()) {
        const amount = (parseFloat(it.qty) || 0) * (parseFloat(it.rate) || 0);
        await client.query(
          `INSERT INTO nakjm_quotation_items (id, quotation_id, sr_no, description, unit, qty, rate, amount, category, remarks)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [uuidv4(), id, it.sr_no || i + 1, it.description, it.unit || null, it.qty || 0, it.rate || 0, amount, it.category || null, it.remarks || null]
        );
      }
      await client.query(
        `UPDATE nakjm_quotations SET subtotal=$1, tax_amount=$2, total_amount=$3, tax_percent=$4, updated_at=NOW() WHERE id=$5`,
        [subtotal, taxAmount, total, data.tax_percent ?? 18, id]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  const allowed = ['status', 'version', 'quotation_date', 'valid_until', 'terms', 'notes'];
  const fields = []; const params = []; let idx = 1;
  for (const f of allowed) {
    if (data[f] !== undefined) { fields.push(`${f} = $${idx++}`); params.push(data[f]); }
  }
  if (fields.length) {
    fields.push('updated_at = NOW()');
    params.push(id);
    let sql = `UPDATE nakjm_quotations SET ${fields.join(', ')} WHERE id = $${idx}`;
    const tenant = tenantWhere(req, idx + 1);
    if (tenant.clause) { sql += ` AND ${tenant.clause}`; params.push(...tenant.params); }
    const res = await query(`${sql} RETURNING id`, params);
    if (!res.rows[0]) { const e = new Error('Quotation not found'); e.status = 404; throw e; }
  }
  return getOne(id, req);
};

const remove = async (id, req) => {
  let sql = 'DELETE FROM nakjm_quotations WHERE id = $1';
  const params = [id];
  const tenant = tenantWhere(req, 2);
  if (tenant.clause) { sql += ` AND ${tenant.clause}`; params.push(...tenant.params); }
  const res = await query(`${sql} RETURNING id`, params);
  if (!res.rows[0]) { const e = new Error('Quotation not found'); e.status = 404; throw e; }
};

module.exports = { list, getOne, create, update, remove };
