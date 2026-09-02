'use strict';

const { query } = require('../config/database');
const audit = require('./audit.service');

// Tenant Health snapshot for the Support Center (spec section 43):
// provisioning/billing/integration/error signals pulled from what this
// platform already tracks, no new instrumentation needed.
const tenantHealth = async (tenantId) => {
  const tenantRes = await query(`SELECT * FROM tenants WHERE id = $1`, [tenantId]);
  const tenant = tenantRes.rows[0];
  if (!tenant) { const e = new Error('Tenant not found'); e.status = 404; throw e; }

  const [usageRes, overdueRes, failedPaymentsRes, recentAuditRes] = await Promise.all([
    query(`SELECT COUNT(*) FROM tenant_usage_snapshots WHERE tenant_id = $1`, [tenantId]),
    query(`SELECT COUNT(*) FROM invoices WHERE tenant_id = $1 AND status = 'overdue'`, [tenantId]),
    query(`SELECT COUNT(*) FROM payments WHERE tenant_id = $1 AND status = 'failed'`, [tenantId]),
    query(`SELECT action, details, created_at FROM audit_log WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 10`, [tenantId]),
  ]);

  return {
    tenant_id: tenantId,
    provisioning: tenant.api_key ? 'ok' : 'not_provisioned',
    billing: tenant.billing_plan_id || tenant.billing_model_override ? 'configured' : 'unconfigured',
    usage_reported: Number(usageRes.rows[0].count) > 0,
    overdue_invoices: Number(overdueRes.rows[0].count),
    failed_payments: Number(failedPaymentsRes.rows[0].count),
    recent_activity: recentAuditRes.rows,
  };
};

const start = async (tenantId, reason, durationMinutes, actor) => {
  if (!reason || !reason.trim()) { const e = new Error('Reason is required.'); e.status = 400; throw e; }
  const minutes = Number(durationMinutes);
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 480) {
    const e = new Error('Duration must be between 1 and 480 minutes.'); e.status = 400; throw e;
  }

  const res = await query(
    `INSERT INTO support_sessions (tenant_id, super_admin_id, reason, duration_minutes, expires_at)
     VALUES ($1,$2,$3,$4, NOW() + ($4::int * INTERVAL '1 minute')) RETURNING *`,
    [tenantId, actor?.id || null, reason.trim(), minutes]
  );
  await audit.log({ superAdminId: actor?.id, tenantId, action: 'support.session_started', details: { reason, duration_minutes: minutes } });
  return res.rows[0];
};

const end = async (sessionId, actor) => {
  const res = await query(
    `UPDATE support_sessions SET ended_at = NOW() WHERE id = $1 AND ended_at IS NULL RETURNING *`,
    [sessionId]
  );
  if (!res.rows[0]) { const e = new Error('Support session not found or already ended.'); e.status = 404; throw e; }
  await audit.log({ superAdminId: actor?.id, tenantId: res.rows[0].tenant_id, action: 'support.session_ended', details: { session_id: sessionId } });
  return res.rows[0];
};

const listForTenant = async (tenantId) => {
  const res = await query(
    `SELECT s.*, sa.name AS super_admin_name FROM support_sessions s
     LEFT JOIN super_admins sa ON sa.id = s.super_admin_id
     WHERE s.tenant_id = $1 ORDER BY s.started_at DESC LIMIT 20`,
    [tenantId]
  );
  return res.rows;
};

module.exports = { tenantHealth, start, end, listForTenant };
