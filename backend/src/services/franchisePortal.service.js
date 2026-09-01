'use strict';

// The franchise partner's own portal — everything here is scoped to a
// single franchise_id (the caller's own, from req.user.franchise_id via
// franchise.controller.js's portal* handlers, or an explicit id an ADMIN
// passes for the admin-side management endpoints). Mirrors the sections
// of crm/src/app/portal/[leadId]/page.tsx (Livanto's franchise/investor
// portal): stage tracker, documents, payments, bank details, support.

const fs = require('fs');
const path = require('path');
const { query } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { tenantWhere, tenantIdForInsert } = require('../middleware/tenantScope');
const { UPLOAD_ROOT } = require('../utils/upload');

// ── Documents ────────────────────────────────────────────────────────────

const listDocuments = async (franchiseId, req) => {
  const conditions = ['franchise_id = $1'];
  const params = [franchiseId];
  const tenant = tenantWhere(req, 2);
  if (tenant.clause) { conditions.push(tenant.clause); params.push(...tenant.params); }
  const res = await query(
    `SELECT * FROM franchise_documents WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`,
    params
  );
  return res.rows;
};

const uploadDocument = async (franchiseId, { file, kind, uploaded_by = null }, req) => {
  if (!file) { const e = new Error('file is required'); e.status = 400; throw e; }
  if (!kind) { const e = new Error('kind is required'); e.status = 400; throw e; }
  const id = uuidv4();
  const res = await query(
    `INSERT INTO franchise_documents (id, tenant_id, franchise_id, kind, file_name, file_path, mime_type, size_bytes, uploaded_by, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW()) RETURNING *`,
    [id, tenantIdForInsert(req), franchiseId, kind, file.originalname, file.filename, file.mimetype, file.size, uploaded_by]
  );
  return res.rows[0];
};

const getDocument = async (id, req) => {
  const conditions = ['id = $1'];
  const params = [id];
  const tenant = tenantWhere(req, 2);
  if (tenant.clause) { conditions.push(tenant.clause); params.push(...tenant.params); }
  const res = await query(`SELECT * FROM franchise_documents WHERE ${conditions.join(' AND ')}`, params);
  if (!res.rows[0]) { const e = new Error('Document not found'); e.status = 404; throw e; }
  return res.rows[0];
};

const removeDocument = async (id, req) => {
  const doc = await getDocument(id, req);
  await query('DELETE FROM franchise_documents WHERE id = $1', [id]);
  fs.unlink(path.join(UPLOAD_ROOT, doc.file_path), () => {});
};

// ── Payments ─────────────────────────────────────────────────────────────

const listPayments = async (franchiseId, req) => {
  const conditions = ['franchise_id = $1'];
  const params = [franchiseId];
  const tenant = tenantWhere(req, 2);
  if (tenant.clause) { conditions.push(tenant.clause); params.push(...tenant.params); }
  const res = await query(
    `SELECT * FROM franchise_payments WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`,
    params
  );
  return res.rows;
};

const createPayment = async (franchiseId, { kind = 'installment', amount, due_date = null, notes = null }, req) => {
  if (!amount) { const e = new Error('amount is required'); e.status = 400; throw e; }
  const id = uuidv4();
  const res = await query(
    `INSERT INTO franchise_payments (id, tenant_id, franchise_id, kind, amount, due_date, notes, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,NOW()) RETURNING *`,
    [id, tenantIdForInsert(req), franchiseId, kind, amount, due_date, notes]
  );
  return res.rows[0];
};

const markPaymentPaid = async (id, req) => {
  const tenant = tenantWhere(req, 2);
  const sql = `UPDATE franchise_payments SET status = 'paid', paid_at = NOW() WHERE id = $1${tenant.clause ? ' AND ' + tenant.clause : ''} RETURNING *`;
  const res = await query(sql, [id, ...tenant.params]);
  if (!res.rows[0]) { const e = new Error('Payment not found'); e.status = 404; throw e; }
  return res.rows[0];
};

// ── Bank details (franchise's own refund/payout account) ──────────────────

const getBankDetails = async (franchiseId, req) => {
  const conditions = ['franchise_id = $1'];
  const params = [franchiseId];
  const tenant = tenantWhere(req, 2);
  if (tenant.clause) { conditions.push(tenant.clause); params.push(...tenant.params); }
  const res = await query(`SELECT * FROM franchise_bank_details WHERE ${conditions.join(' AND ')}`, params);
  return res.rows[0] || null;
};

const upsertBankDetails = async (franchiseId, { account_holder_name, bank_name, account_number, ifsc, branch = null }, req) => {
  if (!account_holder_name || !bank_name || !account_number || !ifsc) {
    const e = new Error('account_holder_name, bank_name, account_number, and ifsc are required'); e.status = 400; throw e;
  }
  const res = await query(
    `INSERT INTO franchise_bank_details (id, tenant_id, franchise_id, account_holder_name, bank_name, account_number, ifsc, branch, updated_at)
     VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (franchise_id) DO UPDATE SET
       account_holder_name = $3, bank_name = $4, account_number = $5, ifsc = $6, branch = $7, updated_at = NOW()
     RETURNING *`,
    [tenantIdForInsert(req), franchiseId, account_holder_name, bank_name, account_number, ifsc, branch]
  );
  return res.rows[0];
};

// ── Support requests ─────────────────────────────────────────────────────

const listSupportRequests = async (franchiseId, req) => {
  const conditions = ['franchise_id = $1'];
  const params = [franchiseId];
  const tenant = tenantWhere(req, 2);
  if (tenant.clause) { conditions.push(tenant.clause); params.push(...tenant.params); }
  const res = await query(
    `SELECT * FROM franchise_support_requests WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`,
    params
  );
  return res.rows;
};

const createSupportRequest = async (franchiseId, { subject, message }, req) => {
  if (!subject || !message) { const e = new Error('subject and message are required'); e.status = 400; throw e; }
  const id = uuidv4();
  const res = await query(
    `INSERT INTO franchise_support_requests (id, tenant_id, franchise_id, subject, message, created_at)
     VALUES ($1,$2,$3,$4,$5,NOW()) RETURNING *`,
    [id, tenantIdForInsert(req), franchiseId, subject, message]
  );
  return res.rows[0];
};

// ── Stage ────────────────────────────────────────────────────────────────

const setStage = async (franchiseId, stage, req) => {
  // franchiseId is param $2, so the tenant clause (if any) must start at $3.
  const tenant = tenantWhere(req, 3);
  const sql = `UPDATE franchises SET stage = $1, updated_at = NOW() WHERE id = $2${tenant.clause ? ' AND ' + tenant.clause : ''} RETURNING *`;
  const res = await query(sql, [stage, franchiseId, ...tenant.params]);
  if (!res.rows[0]) { const e = new Error('Franchise not found'); e.status = 404; throw e; }
  return res.rows[0];
};

module.exports = {
  listDocuments, uploadDocument, getDocument, removeDocument,
  listPayments, createPayment, markPaymentPaid,
  getBankDetails, upsertBankDetails,
  listSupportRequests, createSupportRequest,
  setStage,
};
