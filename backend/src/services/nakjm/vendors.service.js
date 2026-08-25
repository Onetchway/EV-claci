'use strict';

const { query } = require('../../config/database');
const { v4: uuidv4 } = require('uuid');
const { paginate, paginatedResponse } = require('../../utils/pagination');

const list = async (filters) => {
  const { page, limit, skip } = paginate(filters);
  const conditions = [];
  const params = [];
  let idx = 1;

  if (filters.status)   { conditions.push(`status = $${idx++}`);   params.push(filters.status); }
  if (filters.category) { conditions.push(`category = $${idx++}`); params.push(filters.category); }
  if (filters.search)   { conditions.push(`name ILIKE $${idx++}`); params.push(`%${filters.search}%`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRes = await query(`SELECT COUNT(*) FROM nakjm_vendors ${where}`, params);
  const total = parseInt(countRes.rows[0].count, 10);

  const dataRes = await query(
    `SELECT v.*,
      (SELECT COUNT(*) FROM nakjm_purchase_orders po WHERE po.vendor_id = v.id) AS po_count,
      (SELECT COALESCE(SUM(amount),0) FROM nakjm_vendor_payments vp WHERE vp.vendor_id = v.id) AS total_paid
     FROM nakjm_vendors v ${where}
     ORDER BY v.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, skip]
  );

  return paginatedResponse(dataRes.rows, total, page, limit);
};

const getOne = async (id) => {
  const res = await query('SELECT * FROM nakjm_vendors WHERE id = $1', [id]);
  if (!res.rows[0]) { const e = new Error('Vendor not found'); e.status = 404; throw e; }

  const [posRes, paymentsRes] = await Promise.all([
    query(
      `SELECT po.*, p.name AS project_name FROM nakjm_purchase_orders po
       LEFT JOIN nakjm_projects p ON p.id = po.project_id
       WHERE po.vendor_id = $1 ORDER BY po.created_at DESC`,
      [id]
    ),
    query(
      `SELECT vp.*, p.name AS project_name FROM nakjm_vendor_payments vp
       LEFT JOIN nakjm_projects p ON p.id = vp.project_id
       WHERE vp.vendor_id = $1 ORDER BY vp.payment_date DESC`,
      [id]
    ),
  ]);

  const totalPoValue = posRes.rows.reduce((s, po) => s + parseFloat(po.total_amount), 0);
  const totalPaid = paymentsRes.rows.reduce((s, p) => s + parseFloat(p.amount), 0);

  return {
    ...res.rows[0],
    purchase_orders: posRes.rows,
    payments: paymentsRes.rows,
    total_po_value: totalPoValue,
    total_paid: totalPaid,
    outstanding: totalPoValue - totalPaid,
  };
};

const create = async (data) => {
  const {
    name, category = 'other', contact_name = null, contact_email = null, contact_phone = null,
    address = null, gstin = null, bank_account_no = null, bank_ifsc = null, bank_name = null,
    rating = 0, status = 'active', notes = null,
  } = data;
  if (!name) { const e = new Error('name is required'); e.status = 400; throw e; }
  const id = uuidv4();
  const res = await query(
    `INSERT INTO nakjm_vendors (id, name, category, contact_name, contact_email, contact_phone, address, gstin, bank_account_no, bank_ifsc, bank_name, rating, status, notes, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW(),NOW()) RETURNING *`,
    [id, name, category, contact_name, contact_email, contact_phone, address, gstin, bank_account_no, bank_ifsc, bank_name, rating, status, notes]
  );
  return res.rows[0];
};

const update = async (id, data) => {
  const allowed = ['name', 'category', 'contact_name', 'contact_email', 'contact_phone', 'address', 'gstin', 'bank_account_no', 'bank_ifsc', 'bank_name', 'rating', 'status', 'notes'];
  const fields = []; const params = []; let idx = 1;
  for (const f of allowed) {
    if (data[f] !== undefined) { fields.push(`${f} = $${idx++}`); params.push(data[f]); }
  }
  if (!fields.length) { const e = new Error('No valid fields to update'); e.status = 400; throw e; }
  fields.push('updated_at = NOW()');
  params.push(id);
  const res = await query(`UPDATE nakjm_vendors SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, params);
  if (!res.rows[0]) { const e = new Error('Vendor not found'); e.status = 404; throw e; }
  return res.rows[0];
};

const remove = async (id) => {
  const res = await query('DELETE FROM nakjm_vendors WHERE id = $1 RETURNING id', [id]);
  if (!res.rows[0]) { const e = new Error('Vendor not found'); e.status = 404; throw e; }
};

module.exports = { list, getOne, create, update, remove };
