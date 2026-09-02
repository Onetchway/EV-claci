'use strict';

const { query, getClient } = require('../config/database');

const currentPeriodMonth = () => {
  const periodMonth = new Date();
  periodMonth.setDate(1);
  periodMonth.setHours(0, 0, 0, 0);
  return periodMonth.toISOString().slice(0, 10);
};

// A tenant pushes their current employee count for the billing period.
// Kept as its own entry point (not just derived from reportEmployees
// below) for a tenant whose CRM only wants to share a number.
const reportUsage = async (tenantId, employeeCount) => {
  if (!Number.isInteger(employeeCount) || employeeCount < 0) {
    const e = new Error('employee_count must be a non-negative integer.'); e.status = 400; throw e;
  }

  const res = await query(
    `INSERT INTO tenant_usage_snapshots (tenant_id, period_month, employee_count, reported_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (tenant_id, period_month)
     DO UPDATE SET employee_count = $3, reported_at = NOW()
     RETURNING *`,
    [tenantId, currentPeriodMonth(), employeeCount]
  );
  return res.rows[0];
};

const latestForTenant = async (tenantId) => {
  const res = await query(
    `SELECT * FROM tenant_usage_snapshots WHERE tenant_id = $1 ORDER BY period_month DESC LIMIT 12`,
    [tenantId]
  );
  return res.rows;
};

// A tenant pushes which of their CRM users are currently active, by an
// opaque per-tenant id (that CRM's own Firebase uid) -- never a name or
// email; see tenant_employees's own table comment. This is what lets
// per-employee billing prorate by join/leave date (Google Workspace
// style) instead of just counting heads at month end: a seat added
// mid-month is billed only for the days it existed.
//
// Each call is this tenant's full current active set: a first-seen uid
// gets a fresh first_seen_at; a previously-seen uid not named this time
// (or named but active:false) gets removed_at stamped, unless already
// set; a uid that reappears after being removed simply has removed_at
// cleared (first_seen_at is never reset, so proration always reflects
// the true original join date).
const reportEmployees = async (tenantId, employees) => {
  if (!Array.isArray(employees)) {
    const e = new Error('employees must be an array.'); e.status = 400; throw e;
  }
  for (const emp of employees) {
    if (!emp || typeof emp.external_uid !== 'string' || !emp.external_uid) {
      const e = new Error('Each employee needs an external_uid.'); e.status = 400; throw e;
    }
  }

  const activeUids = employees.filter((e) => e.active !== false).map((e) => e.external_uid);

  const client = await getClient();
  try {
    await client.query('BEGIN');

    if (activeUids.length) {
      await client.query(
        `INSERT INTO tenant_employees (tenant_id, external_uid, first_seen_at, removed_at, reported_at)
         SELECT $1, u, NOW(), NULL, NOW() FROM unnest($2::varchar[]) AS u
         ON CONFLICT (tenant_id, external_uid)
         DO UPDATE SET removed_at = NULL, reported_at = NOW()`,
        [tenantId, activeUids],
      );
    }

    // Everyone else this tenant has ever reported, who isn't in the
    // active set this time, is now (or still) removed.
    await client.query(
      activeUids.length
        ? `UPDATE tenant_employees SET removed_at = COALESCE(removed_at, NOW()), reported_at = NOW()
           WHERE tenant_id = $1 AND external_uid <> ALL($2::varchar[]) AND removed_at IS NULL`
        : `UPDATE tenant_employees SET removed_at = COALESCE(removed_at, NOW()), reported_at = NOW()
           WHERE tenant_id = $1 AND removed_at IS NULL`,
      activeUids.length ? [tenantId, activeUids] : [tenantId],
    );

    await client.query(
      `INSERT INTO tenant_usage_snapshots (tenant_id, period_month, employee_count, reported_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (tenant_id, period_month)
       DO UPDATE SET employee_count = $3, reported_at = NOW()`,
      [tenantId, currentPeriodMonth(), activeUids.length],
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return { employee_count: activeUids.length };
};

// Prorated per-employee charge for [periodStart, periodEnd) -- each
// employee active at any point in the window contributes
// (days active within the window / days in the window) * unitAmount,
// matching how Google Workspace bills a seat added or removed mid-cycle.
// Returns the subtotal plus a headcount (anyone touched during the
// window at all) for display -- that headcount times unitAmount will NOT
// generally equal the subtotal, by design, whenever anyone joined or
// left mid-period.
const proratedEmployeeCharge = async (tenantId, periodStart, periodEnd, unitAmount) => {
  const res = await query(
    `SELECT first_seen_at, removed_at FROM tenant_employees
     WHERE tenant_id = $1 AND first_seen_at < $3 AND (removed_at IS NULL OR removed_at > $2)`,
    [tenantId, periodStart, periodEnd],
  );

  const windowMs = periodEnd.getTime() - periodStart.getTime();
  let subtotal = 0;
  for (const row of res.rows) {
    const start = Math.max(new Date(row.first_seen_at).getTime(), periodStart.getTime());
    const end = Math.min(row.removed_at ? new Date(row.removed_at).getTime() : periodEnd.getTime(), periodEnd.getTime());
    const overlapMs = Math.max(0, end - start);
    subtotal += (overlapMs / windowMs) * unitAmount;
  }

  return { subtotal: Math.round(subtotal * 100) / 100, employeeCount: res.rows.length };
};

module.exports = { reportUsage, latestForTenant, reportEmployees, proratedEmployeeCharge };
