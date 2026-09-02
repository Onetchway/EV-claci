'use strict';

const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const audit = require('./audit.service');

const list = async () => {
  const res = await query(
    `SELECT id, name, email, role, is_active, created_at FROM super_admins ORDER BY created_at ASC`
  );
  return res.rows;
};

const create = async (data, actor) => {
  if (!data.name || !data.email || !data.password) {
    const e = new Error('name, email and password are required.'); e.status = 400; throw e;
  }
  if (data.password.length < 8) { const e = new Error('Password must be at least 8 characters.'); e.status = 400; throw e; }
  const role = ['super_admin', 'billing_ops', 'support', 'operations', 'read_only'].includes(data.role) ? data.role : 'support';
  const passwordHash = await bcrypt.hash(data.password, 10);
  const res = await query(
    `INSERT INTO super_admins (name, email, password_hash, role, is_active)
     VALUES ($1,$2,$3,$4,true) RETURNING id, name, email, role, is_active, created_at`,
    [data.name, data.email.toLowerCase(), passwordHash, role]
  );
  await audit.log({ superAdminId: actor?.id, action: 'admin.created', details: { admin_id: res.rows[0].id, email: res.rows[0].email, role } });
  return res.rows[0];
};

// A super admin can't lock themself or the last active super_admin out.
const guardSelfLockout = async (targetId, data, actor) => {
  const isSelf = actor?.id === targetId;
  const demoting = data.role !== undefined && data.role !== 'super_admin';
  const deactivating = data.is_active === false;
  if (!isSelf || (!demoting && !deactivating)) return;

  const res = await query(
    `SELECT COUNT(*) FROM super_admins WHERE role = 'super_admin' AND is_active = true AND id != $1`,
    [targetId]
  );
  if (Number(res.rows[0].count) === 0) {
    const e = new Error('Cannot remove the last active super admin.'); e.status = 400; throw e;
  }
};

const ALLOWED = ['name', 'role', 'is_active'];
const update = async (id, data, actor) => {
  await guardSelfLockout(id, data, actor);

  const fields = []; const params = []; let idx = 1;
  for (const f of ALLOWED) {
    if (data[f] !== undefined) { fields.push(`${f} = $${idx++}`); params.push(data[f]); }
  }
  if (data.password) {
    if (data.password.length < 8) { const e = new Error('Password must be at least 8 characters.'); e.status = 400; throw e; }
    fields.push(`password_hash = $${idx++}`);
    params.push(await bcrypt.hash(data.password, 10));
  }
  if (!fields.length) { const e = new Error('No valid fields to update.'); e.status = 400; throw e; }
  fields.push('updated_at = NOW()');
  params.push(id);

  const res = await query(
    `UPDATE super_admins SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, name, email, role, is_active, created_at`,
    params
  );
  if (!res.rows[0]) { const e = new Error('Administrator not found'); e.status = 404; throw e; }
  await audit.log({ superAdminId: actor?.id, action: 'admin.updated', details: { admin_id: id, fields: Object.keys(data) } });
  return res.rows[0];
};

module.exports = { list, create, update };
