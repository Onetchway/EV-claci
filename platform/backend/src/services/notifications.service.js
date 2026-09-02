'use strict';

const { query } = require('../config/database');
const { emailConfigured, sendEmail } = require('./email.service');

// A subset of notification types worth interrupting a super admin's inbox
// for -- everything still lands in the in-app bell regardless, this only
// controls the extra email channel. Routine/informational types (a tenant
// signed up, a payment succeeded) stay in-app only.
const EMAIL_WORTHY = new Set([
  'payment_failed', 'auto_charge_failed', 'provisioning_failure', 'trial_ended', 'payment_retry_needed',
]);

const emailActiveAdmins = async (title, message) => {
  const res = await query(`SELECT email FROM super_admins WHERE is_active = true`);
  const to = res.rows.map((r) => r.email);
  if (!to.length) return;
  await sendEmail({ to, subject: `[Alpha] ${title}`, html: `<p>${message || title}</p>` });
};

// Emits an in-app notification -- called at the same call sites that
// already audit.log() the same event (tenant created, payment captured/
// failed, provisioning failure, trial ending, etc). Fire-and-forget:
// never throws into the caller's own success path. Also emails every
// active super admin for the EMAIL_WORTHY subset, when SMTP is configured.
const emit = async ({ type, title, message, tenantId }) => {
  try {
    await query(
      `INSERT INTO notifications (type, title, message, tenant_id) VALUES ($1,$2,$3,$4)`,
      [type, title, message || null, tenantId || null]
    );
  } catch (err) {
    console.error('[notifications] Failed to emit:', err.message);
  }

  if (EMAIL_WORTHY.has(type) && emailConfigured()) {
    emailActiveAdmins(title, message).catch((err) => console.error('[notifications] Failed to email admins:', err.message));
  }
};

const list = async (filters = {}) => {
  const limit = Math.min(Number(filters.limit) || 30, 100);
  const res = await query(
    `SELECT n.*, t.name AS tenant_name FROM notifications n
     LEFT JOIN tenants t ON t.id = n.tenant_id
     ORDER BY n.created_at DESC LIMIT $1`,
    [limit]
  );
  return res.rows;
};

const unreadCount = async () => {
  const res = await query(`SELECT COUNT(*) FROM notifications WHERE is_read = false`);
  return Number(res.rows[0].count);
};

const markRead = async (id) => {
  await query(`UPDATE notifications SET is_read = true WHERE id = $1`, [id]);
};

const markAllRead = async () => {
  await query(`UPDATE notifications SET is_read = true WHERE is_read = false`);
};

module.exports = { emit, list, unreadCount, markRead, markAllRead };
