'use strict';

const { query } = require('../../config/database');
const { v4: uuidv4 } = require('uuid');
const { paginate, paginatedResponse } = require('../../utils/pagination');

// ── Client payments (collection) ────────────────────────────────────────
const listClientPayments = async (filters) => {
  const { page, limit, skip } = paginate(filters);
  const conditions = [];
  const params = [];
  let idx = 1;

  if (filters.project_id) { conditions.push(`cp.project_id = $${idx++}`); params.push(filters.project_id); }
  if (filters.client_id)  { conditions.push(`cp.client_id = $${idx++}`);  params.push(filters.client_id); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const countRes = await query(`SELECT COUNT(*) FROM nakjm_client_payments cp ${where}`, params);
  const total = parseInt(countRes.rows[0].count, 10);

  const dataRes = await query(
    `SELECT cp.*, p.name AS project_name, c.name AS client_name FROM nakjm_client_payments cp
     LEFT JOIN nakjm_projects p ON p.id = cp.project_id
     LEFT JOIN nakjm_clients c ON c.id = cp.client_id
     ${where} ORDER BY cp.payment_date DESC LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, skip]
  );
  return paginatedResponse(dataRes.rows, total, page, limit);
};

const createClientPayment = async (data) => {
  const { project_id, client_id, pi_id = null, payment_date = null, amount, mode = 'bank_transfer', reference_no = null, milestone = null, notes = null } = data;
  if (!project_id || !client_id || !amount) { const e = new Error('project_id, client_id, and amount are required'); e.status = 400; throw e; }
  const id = uuidv4();
  const res = await query(
    `INSERT INTO nakjm_client_payments (id, project_id, client_id, pi_id, payment_date, amount, mode, reference_no, milestone, notes, created_at)
     VALUES ($1,$2,$3,$4,COALESCE($5,CURRENT_DATE),$6,$7,$8,$9,$10,NOW()) RETURNING *`,
    [id, project_id, client_id, pi_id, payment_date, amount, mode, reference_no, milestone, notes]
  );
  if (pi_id) {
    await query(
      `UPDATE nakjm_proforma_invoices SET status = CASE
         WHEN (SELECT COALESCE(SUM(amount),0) FROM nakjm_client_payments WHERE pi_id = $1) >= total_amount THEN 'paid'
         ELSE 'partially_paid' END, updated_at = NOW()
       WHERE id = $1`,
      [pi_id]
    );
  }
  return res.rows[0];
};

const removeClientPayment = async (id) => {
  const res = await query('DELETE FROM nakjm_client_payments WHERE id = $1 RETURNING id', [id]);
  if (!res.rows[0]) { const e = new Error('Payment not found'); e.status = 404; throw e; }
};

// ── Vendor payments (payouts) ───────────────────────────────────────────
const listVendorPayments = async (filters) => {
  const { page, limit, skip } = paginate(filters);
  const conditions = [];
  const params = [];
  let idx = 1;

  if (filters.project_id) { conditions.push(`vp.project_id = $${idx++}`); params.push(filters.project_id); }
  if (filters.vendor_id)  { conditions.push(`vp.vendor_id = $${idx++}`);  params.push(filters.vendor_id); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const countRes = await query(`SELECT COUNT(*) FROM nakjm_vendor_payments vp ${where}`, params);
  const total = parseInt(countRes.rows[0].count, 10);

  const dataRes = await query(
    `SELECT vp.*, p.name AS project_name, v.name AS vendor_name FROM nakjm_vendor_payments vp
     LEFT JOIN nakjm_projects p ON p.id = vp.project_id
     LEFT JOIN nakjm_vendors v ON v.id = vp.vendor_id
     ${where} ORDER BY vp.payment_date DESC LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, skip]
  );
  return paginatedResponse(dataRes.rows, total, page, limit);
};

const createVendorPayment = async (data) => {
  const { vendor_id, project_id, po_id = null, payment_date = null, amount, mode = 'bank_transfer', reference_no = null, notes = null } = data;
  if (!vendor_id || !project_id || !amount) { const e = new Error('vendor_id, project_id, and amount are required'); e.status = 400; throw e; }
  const id = uuidv4();
  const res = await query(
    `INSERT INTO nakjm_vendor_payments (id, vendor_id, project_id, po_id, payment_date, amount, mode, reference_no, notes, created_at)
     VALUES ($1,$2,$3,$4,COALESCE($5,CURRENT_DATE),$6,$7,$8,$9,NOW()) RETURNING *`,
    [id, vendor_id, project_id, po_id, payment_date, amount, mode, reference_no, notes]
  );
  if (po_id) {
    await query(
      `UPDATE nakjm_purchase_orders SET status = CASE
         WHEN (SELECT COALESCE(SUM(amount),0) FROM nakjm_vendor_payments WHERE po_id = $1) >= total_amount THEN 'completed'
         ELSE status END, updated_at = NOW()
       WHERE id = $1`,
      [po_id]
    );
  }
  return res.rows[0];
};

const removeVendorPayment = async (id) => {
  const res = await query('DELETE FROM nakjm_vendor_payments WHERE id = $1 RETURNING id', [id]);
  if (!res.rows[0]) { const e = new Error('Payment not found'); e.status = 404; throw e; }
};

module.exports = {
  listClientPayments, createClientPayment, removeClientPayment,
  listVendorPayments, createVendorPayment, removeVendorPayment,
};
