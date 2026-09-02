'use strict';

const { query } = require('../config/database');

// Aggregate, billing-relevant numbers only — same boundary as everywhere
// else in the platform: no tenant employee/operational data, just counts
// and money the platform itself is responsible for.
const overview = async () => {
  const [
    tenantsByStatus, mrr, seats, invoiceTotals, overdueInvoices, trialsEndingSoon, revenueTrend, recentAudit,
  ] = await Promise.all([
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

    // Active users = every active tenant's latest reported headcount
    // (whatever their billing model — a fixed-fee tenant still has real
    // users, just isn't billed per-seat). Billable seats narrows that to
    // just the per-employee tenants, which is what actually drives MRR
    // above.
    query(`
      SELECT
        COALESCE(SUM(latest_usage.employee_count), 0) AS active_users,
        COALESCE(SUM(latest_usage.employee_count) FILTER (
          WHERE COALESCE(t.billing_model_override, bp.billing_model) = 'per_employee'
        ), 0) AS billable_seats
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

    // Trials ending within the next 7 days — the other half of "needs
    // attention" alongside overdue invoices; both are real, queryable
    // signals (no provisioning-failure tracking exists yet to add a third).
    query(`
      SELECT id, name, trial_ends_at FROM tenants
      WHERE status = 'trial' AND trial_ends_at IS NOT NULL
        AND trial_ends_at BETWEEN NOW() AND NOW() + INTERVAL '7 days'
      ORDER BY trial_ends_at ASC
    `),

    // Actual issued invoice totals per month, last 6 months — real billed
    // revenue over time (not a projection), since no historical MRR
    // snapshot table exists yet to chart a truer recurring-revenue trend.
    query(`
      SELECT to_char(date_trunc('month', issued_at), 'YYYY-MM') AS month,
             COALESCE(SUM(total_amount), 0) AS total
      FROM invoices
      WHERE issued_at >= date_trunc('month', NOW()) - INTERVAL '5 months'
      GROUP BY 1 ORDER BY 1 ASC
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

  const estimatedMrr = Number(mrr.rows[0].mrr);

  return {
    tenants_by_status: Object.fromEntries(tenantsByStatus.rows.map((r) => [r.status, parseInt(r.count, 10)])),
    estimated_mrr: estimatedMrr,
    estimated_arr: estimatedMrr * 12,
    active_users: parseInt(seats.rows[0].active_users, 10),
    billable_seats: parseInt(seats.rows[0].billable_seats, 10),
    invoices_by_status: Object.fromEntries(invoiceTotals.rows.map((r) => [r.status, { count: parseInt(r.count, 10), total: Number(r.total) }])),
    overdue_invoices: overdueInvoices.rows,
    trials_ending_soon: trialsEndingSoon.rows,
    revenue_trend: revenueTrend.rows.map((r) => ({ month: r.month, total: Number(r.total) })),
    recent_activity: recentAudit.rows,
  };
};

module.exports = { overview };
