'use strict';

const { query, getClient } = require('../../config/database');
const { v4: uuidv4 } = require('uuid');
const { paginate, paginatedResponse } = require('../../utils/pagination');
const { tenantWhere, tenantIdForInsert } = require('../../middleware/tenantScope');

const computeTotals = (items, taxPercent = 0) => {
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
  if (tenant.clause) { conditions.push(tenant.clause.replace('tenant_id', 'po.tenant_id')); params.push(...tenant.params); idx += tenant.params.length; }

  if (filters.project_id) { conditions.push(`po.project_id = $${idx++}`); params.push(filters.project_id); }
  if (filters.vendor_id)  { conditions.push(`po.vendor_id = $${idx++}`);  params.push(filters.vendor_id); }
  if (filters.status)     { conditions.push(`po.status = $${idx++}`);     params.push(filters.status); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRes = await query(`SELECT COUNT(*) FROM nakjm_purchase_orders po ${where}`, params);
  const total = parseInt(countRes.rows[0].count, 10);

  const dataRes = await query(
    `SELECT po.*, p.name AS project_name, v.name AS vendor_name,
      (SELECT COALESCE(SUM(amount),0) FROM nakjm_vendor_payments vp WHERE vp.po_id = po.id) AS paid_amount
     FROM nakjm_purchase_orders po
     LEFT JOIN nakjm_projects p ON p.id = po.project_id
     LEFT JOIN nakjm_vendors v ON v.id = po.vendor_id
     ${where} ORDER BY po.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, skip]
  );

  return paginatedResponse(dataRes.rows, total, page, limit);
};

const getOne = async (id, req) => {
  const conditions = ['po.id = $1'];
  const params = [id];
  const tenant = tenantWhere(req, 2);
  if (tenant.clause) { conditions.push(tenant.clause.replace('tenant_id', 'po.tenant_id')); params.push(...tenant.params); }
  const res = await query(
    `SELECT po.*, p.name AS project_name, v.name AS vendor_name FROM nakjm_purchase_orders po
     LEFT JOIN nakjm_projects p ON p.id = po.project_id
     LEFT JOIN nakjm_vendors v ON v.id = po.vendor_id
     WHERE ${conditions.join(' AND ')}`,
    params
  );
  if (!res.rows[0]) { const e = new Error('Purchase order not found'); e.status = 404; throw e; }
  const itemsRes = await query('SELECT * FROM nakjm_po_items WHERE po_id = $1', [id]);
  const paidRes = await query('SELECT COALESCE(SUM(amount),0) AS paid FROM nakjm_vendor_payments WHERE po_id = $1', [id]);
  return { ...res.rows[0], items: itemsRes.rows, paid_amount: parseFloat(paidRes.rows[0].paid) };
};

const create = async (data, req) => {
  const {
    po_no, project_id, vendor_id, po_date = null, delivery_date = null, status = 'draft',
    tax_amount = 0, terms = null, notes = null, items = [],
  } = data;
  if (!po_no || !project_id || !vendor_id) {
    const e = new Error('po_no, project_id, and vendor_id are required'); e.status = 400; throw e;
  }
  const { subtotal, total } = computeTotals(items, 0);
  const finalTotal = parseFloat((subtotal + (parseFloat(tax_amount) || 0)).toFixed(2));

  const client = await getClient();
  try {
    await client.query('BEGIN');
    const id = uuidv4();
    await client.query(
      `INSERT INTO nakjm_purchase_orders (id, tenant_id, po_no, project_id, vendor_id, po_date, delivery_date, status, subtotal, tax_amount, total_amount, terms, notes, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,COALESCE($6,CURRENT_DATE),$7,$8,$9,$10,$11,$12,$13,NOW(),NOW())`,
      [id, tenantIdForInsert(req), po_no, project_id, vendor_id, po_date, delivery_date, status, subtotal, tax_amount, finalTotal, terms, notes]
    );
    for (const it of items) {
      const amount = (parseFloat(it.qty) || 0) * (parseFloat(it.rate) || 0);
      await client.query(
        `INSERT INTO nakjm_po_items (id, po_id, description, unit, qty, rate, amount) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
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
    const { subtotal } = computeTotals(data.items, 0);
    const taxAmount = data.tax_amount !== undefined ? parseFloat(data.tax_amount) : 0;
    const client = await getClient();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM nakjm_po_items WHERE po_id = $1', [id]);
      for (const it of data.items) {
        const amount = (parseFloat(it.qty) || 0) * (parseFloat(it.rate) || 0);
        await client.query(
          `INSERT INTO nakjm_po_items (id, po_id, description, unit, qty, rate, amount) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [uuidv4(), id, it.description, it.unit || null, it.qty || 0, it.rate || 0, amount]
        );
      }
      await client.query(
        'UPDATE nakjm_purchase_orders SET subtotal=$1, tax_amount=$2, total_amount=$3, updated_at=NOW() WHERE id=$4',
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

  const allowed = ['status', 'delivery_date', 'terms', 'notes'];
  const fields = []; const params = []; let idx = 1;
  for (const f of allowed) {
    if (data[f] !== undefined) { fields.push(`${f} = $${idx++}`); params.push(data[f]); }
  }
  if (fields.length) {
    fields.push('updated_at = NOW()');
    params.push(id);
    let sql = `UPDATE nakjm_purchase_orders SET ${fields.join(', ')} WHERE id = $${idx}`;
    const tenant = tenantWhere(req, idx + 1);
    if (tenant.clause) { sql += ` AND ${tenant.clause}`; params.push(...tenant.params); }
    const res = await query(`${sql} RETURNING id`, params);
    if (!res.rows[0]) { const e = new Error('Purchase order not found'); e.status = 404; throw e; }
  }
  return getOne(id, req);
};

const remove = async (id, req) => {
  let sql = 'DELETE FROM nakjm_purchase_orders WHERE id = $1';
  const params = [id];
  const tenant = tenantWhere(req, 2);
  if (tenant.clause) { sql += ` AND ${tenant.clause}`; params.push(...tenant.params); }
  const res = await query(`${sql} RETURNING id`, params);
  if (!res.rows[0]) { const e = new Error('Purchase order not found'); e.status = 404; throw e; }
};

module.exports = { list, getOne, create, update, remove };
