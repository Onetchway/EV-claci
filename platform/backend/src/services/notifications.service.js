'use strict';

const { query } = require('../config/database');

// Emits an in-app notification -- called at the same call sites that
// already audit.log() the same event (tenant created, payment captured/
// failed, provisioning failure, trial ending, etc). Fire-and-forget:
// never throws into the caller's own success path.
const emit = async ({ type, title, message, tenantId }) => {
  try {
    await query(
      `INSERT INTO notifications (type, title, message, tenant_id) VALUES ($1,$2,$3,$4)`,
      [type, title, message || null, tenantId || null]
    );
  } catch (err) {
    console.error('[notifications] Failed to emit:', err.message);
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
