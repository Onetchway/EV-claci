'use strict';

const { query } = require('../config/database');

// Aggregate, billing-relevant numbers only — same boundary as everywhere
// else in the platform: no tenant employee/operational data, just counts
// and money the platform itself is responsible for.
const overview = async () => {
  const [tenantsByStatus, mrr, invoiceTotals, overdueInvoices, recentAudit] = await Promise.all([
    query(`SELECT status, COUNT(*) FROM tenants GROUP BY status`),

    // Estimated monthly recurring revenue across active tenants: fixed-fee
    // tenants count directly; per-employee tenants use their latest
    // reported headcount (0 if none reported yet).
    query(`
      SELECT COALESCE(SUM(
        CASE
          WHEN COALESCE(t.billing_model_override, bp.billing_model) = 'fixed_monthly'
            THEN COALESCE(t.fixed_monthly_amount_override, bp.fixed_monthly_amount, 0)
          WHEN COALESCE(t.billing_model_override, bp.billing_model) = 'per_employee'
            THEN COALESCE(t.per_employee_amount_override, bp.per_employee_amount, 0) * COALESCE(latest_usage.employee_count, 0)
          ELSE 0
        END
      ), 0) AS mrr
      FROM tenants t
      LEFT JOIN billing_plans bp ON bp.id = t.billing_plan_id
      LEFT JOIN LATERAL (
        SELECT employee_count FROM tenant_usage_snapshots
        WHERE tenant_id = t.id ORDER BY period_month DESC LIMIT 1
      ) latest_usage ON true
      WHERE t.status = 'active'
    `),

    query(`SELECT status, COUNT(*), COALESCE(SUM(total_amount), 0) AS total FROM invoices GROUP BY status`),

    query(`
      SELECT i.id, i.invoice_number, i.total_amount, i.currency, i.due_at, t.name AS tenant_name
      FROM invoices i JOIN tenants t ON t.id = i.tenant_id
      WHERE i.status = 'overdue'
      ORDER BY i.due_at ASC
      LIMIT 20
    `),

    query(`
      SELECT a.action, a.details, a.created_at, t.name AS tenant_name, sa.name AS super_admin_name
      FROM audit_log a
      LEFT JOIN tenants t ON t.id = a.tenant_id
      LEFT JOIN super_admins sa ON sa.id = a.super_admin_id
      ORDER BY a.created_at DESC
      LIMIT 20
    `),
  ]);

  return {
    tenants_by_status: Object.fromEntries(tenantsByStatus.rows.map((r) => [r.status, parseInt(r.count, 10)])),
    estimated_mrr: Number(mrr.rows[0].mrr),
    invoices_by_status: Object.fromEntries(invoiceTotals.rows.map((r) => [r.status, { count: parseInt(r.count, 10), total: Number(r.total) }])),
    overdue_invoices: overdueInvoices.rows,
    recent_activity: recentAudit.rows,
  };
};

module.exports = { overview };
