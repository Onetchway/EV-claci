'use strict';

const fs = require('fs');
const { query } = require('../../config/database');
const { v4: uuidv4 } = require('uuid');
const { tenantWhere, tenantIdForInsert } = require('../../middleware/tenantScope');

const list = async (filters, req) => {
  const conditions = [];
  const params = [];
  let idx = 1;
  const tenant = tenantWhere(req, idx);
  if (tenant.clause) { conditions.push(tenant.clause); params.push(...tenant.params); idx += tenant.params.length; }
  if (filters.project_id) { conditions.push(`project_id = $${idx++}`); params.push(filters.project_id); }
  if (filters.doc_type)   { conditions.push(`doc_type = $${idx++}`);   params.push(filters.doc_type); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const res = await query(`SELECT * FROM nakjm_documents ${where} ORDER BY created_at DESC`, params);
  return res.rows;
};

const getOne = async (id, req) => {
  const conditions = ['id = $1'];
  const params = [id];
  const tenant = tenantWhere(req, 2);
  if (tenant.clause) { conditions.push(tenant.clause); params.push(...tenant.params); }
  const res = await query(`SELECT * FROM nakjm_documents WHERE ${conditions.join(' AND ')}`, params);
  if (!res.rows[0]) { const e = new Error('Document not found'); e.status = 404; throw e; }
  return res.rows[0];
};

const create = async ({ file, project_id = null, doc_type = 'other', notes = null, uploaded_by = null }, req) => {
  if (!file) { const e = new Error('file is required'); e.status = 400; throw e; }
  const id = uuidv4();
  const res = await query(
    `INSERT INTO nakjm_documents (id, tenant_id, project_id, doc_type, file_name, file_path, mime_type, size_bytes, notes, uploaded_by, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW()) RETURNING *`,
    [id, tenantIdForInsert(req), project_id || null, doc_type, file.originalname, file.filename, file.mimetype, file.size, notes, uploaded_by]
  );
  return res.rows[0];
};

const remove = async (id, req) => {
  const doc = await getOne(id, req);
  let sql = 'DELETE FROM nakjm_documents WHERE id = $1';
  const params = [id];
  const tenant = tenantWhere(req, 2);
  if (tenant.clause) { sql += ` AND ${tenant.clause}`; params.push(...tenant.params); }
  await query(sql, params);
  const { UPLOAD_ROOT } = require('../../utils/upload');
  const path = require('path');
  fs.unlink(path.join(UPLOAD_ROOT, doc.file_path), () => {});
};

module.exports = { list, getOne, create, remove };
