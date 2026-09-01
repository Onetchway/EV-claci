'use strict';

const { query, getClient } = require('../../config/database');
const { v4: uuidv4 } = require('uuid');
const { paginate, paginatedResponse } = require('../../utils/pagination');
const { tenantWhere, tenantIdForInsert } = require('../../middleware/tenantScope');

const computeTotals = (items) => {
  const subtotal = items.reduce((s, it) => s + (parseFloat(it.qty) || 0) * (parseFloat(it.rate) || 0), 0);
  return parseFloat(subtotal.toFixed(2));
};

const list = async (filters, req) => {
  const { page, limit, skip } = paginate(filters);
  const conditions = [];
  const params = [];
  let idx = 1;

  const tenant = tenantWhere(req, idx);
  if (tenant.clause) { conditions.push(tenant.clause.replace('tenant_id', 'pi.tenant_id')); params.push(...tenant.params); idx += tenant.params.length; }

  if (filters.project_id) { conditions.push(`pi.project_id = $${idx++}`); params.push(filters.project_id); }
  if (filters.client_id)  { conditions.push(`pi.client_id = $${idx++}`);  params.push(filters.client_id); }
  if (filters.status)     { conditions.push(`pi.status = $${idx++}`);     params.push(filters.status); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRes = await query(`SELECT COUNT(*) FROM nakjm_proforma_invoices pi ${where}`, params);
  const total = parseInt(countRes.rows[0].count, 10);

  const dataRes = await query(
    `SELECT pi.*, p.name AS project_name, c.name AS client_name,
      (SELECT COALESCE(SUM(amount),0) FROM nakjm_client_payments cp WHERE cp.pi_id = pi.id) AS paid_amount
     FROM nakjm_proforma_invoices pi
     LEFT JOIN nakjm_projects p ON p.id = pi.project_id
     LEFT JOIN nakjm_clients c ON c.id = pi.client_id
     ${where} ORDER BY pi.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, skip]
  );

  return paginatedResponse(dataRes.rows, total, page, limit);
};

const getOne = async (id, req) => {
  const conditions = ['pi.id = $1'];
  const params = [id];
  const tenant = tenantWhere(req, 2);
  if (tenant.clause) { conditions.push(tenant.clause.replace('tenant_id', 'pi.tenant_id')); params.push(...tenant.params); }
  const res = await query(
    `SELECT pi.*, p.name AS project_name, c.name AS client_name FROM nakjm_proforma_invoices pi
     LEFT JOIN nakjm_projects p ON p.id = pi.project_id
     LEFT JOIN nakjm_clients c ON c.id = pi.client_id
     WHERE ${conditions.join(' AND ')}`,
    params
  );
  if (!res.rows[0]) { const e = new Error('Proforma invoice not found'); e.status = 404; throw e; }
  const itemsRes = await query('SELECT * FROM nakjm_pi_items WHERE pi_id = $1', [id]);
  const paidRes = await query('SELECT COALESCE(SUM(amount),0) AS paid FROM nakjm_client_payments WHERE pi_id = $1', [id]);
  return { ...res.rows[0], items: itemsRes.rows, paid_amount: parseFloat(paidRes.rows[0].paid) };
};

const create = async (data, req) => {
  const {
    pi_no, project_id, client_id, quotation_id = null, pi_date = null, due_date = null,
    status = 'draft', milestone = null, tax_amount = 0, notes = null, source_document_id = null, items = [],
  } = data;
  if (!pi_no || !project_id || !client_id) {
    const e = new Error('pi_no, project_id, and client_id are required'); e.status = 400; throw e;
  }
  const subtotal = computeTotals(items);
  const total = parseFloat((subtotal + (parseFloat(tax_amount) || 0)).toFixed(2));

  const client = await getClient();
  try {
    await client.query('BEGIN');
    const id = uuidv4();
    await client.query(
      `INSERT INTO nakjm_proforma_invoices (id, tenant_id, pi_no, project_id, client_id, quotation_id, pi_date, due_date, status, milestone, subtotal, tax_amount, total_amount, notes, source_document_id, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7,CURRENT_DATE),$8,$9,$10,$11,$12,$13,$14,$15,NOW(),NOW())`,
      [id, tenantIdForInsert(req), pi_no, project_id, client_id, quotation_id, pi_date, due_date, status, milestone, subtotal, tax_amount, total, notes, source_document_id]
    );
    for (const it of items) {
      const amount = (parseFloat(it.qty) || 0) * (parseFloat(it.rate) || 0);
      await client.query(
        `INSERT INTO nakjm_pi_items (id, pi_id, description, unit, qty, rate, amount) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [uuidv4(), id, it.description, it.unit || null, it.qty || 0, it.rate || 0, amount]
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
    const subtotal = computeTotals(data.items);
    const taxAmount = data.tax_amount !== undefined ? parseFloat(data.tax_amount) : 0;
    const client = await getClient();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM nakjm_pi_items WHERE pi_id = $1', [id]);
      for (const it of data.items) {
        const amount = (parseFloat(it.qty) || 0) * (parseFloat(it.rate) || 0);
        await client.query(
          `INSERT INTO nakjm_pi_items (id, pi_id, description, unit, qty, rate, amount) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [uuidv4(), id, it.description, it.unit || null, it.qty || 0, it.rate || 0, amount]
        );
      }
      await client.query(
        'UPDATE nakjm_proforma_invoices SET subtotal=$1, tax_amount=$2, total_amount=$3, updated_at=NOW() WHERE id=$4',
        [subtotal, taxAmount, parseFloat((subtotal + taxAmount).toFixed(2)), id]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  const allowed = ['status', 'due_date', 'milestone', 'notes'];
  const fields = []; const params = []; let idx = 1;
  for (const f of allowed) {
    if (data[f] !== undefined) { fields.push(`${f} = $${idx++}`); params.push(data[f]); }
  }
  if (fields.length) {
    fields.push('updated_at = NOW()');
    params.push(id);
    let sql = `UPDATE nakjm_proforma_invoices SET ${fields.join(', ')} WHERE id = $${idx}`;
    const tenant = tenantWhere(req, idx + 1);
    if (tenant.clause) { sql += ` AND ${tenant.clause}`; params.push(...tenant.params); }
    const res = await query(`${sql} RETURNING id`, params);
    if (!res.rows[0]) { const e = new Error('Proforma invoice not found'); e.status = 404; throw e; }
  }
  return getOne(id, req);
};

const remove = async (id, req) => {
  let sql = 'DELETE FROM nakjm_proforma_invoices WHERE id = $1';
  const params = [id];
  const tenant = tenantWhere(req, 2);
  if (tenant.clause) { sql += ` AND ${tenant.clause}`; params.push(...tenant.params); }
  const res = await query(`${sql} RETURNING id`, params);
  if (!res.rows[0]) { const e = new Error('Proforma invoice not found'); e.status = 404; throw e; }
};

module.exports = { list, getOne, create, update, remove };
