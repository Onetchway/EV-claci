'use strict';

const { query } = require('../config/database');
const audit = require('./audit.service');
const notifications = require('./notifications.service');

// Named transitions rather than a raw status PATCH -- each one encodes which
// states it's valid from and what else has to change alongside the status
// (cancelled_at, archived_at, a fresh trial_ends_at), so the lifecycle in
// spec §49/§28 is enforced here once instead of trusted to whoever calls
// tenants.service.js's generic update().
const ACTIONS = {
  start_trial: {
    from: ['lead'],
    to: 'trial',
    apply: (t) => ({ trial_ends_at: t.trial_ends_at || fromNowDays(14) }),
  },
  activate: {
    from: ['trial', 'past_due', 'paused', 'suspended'],
    to: 'active',
  },
  pause: {
    from: ['active'],
    to: 'paused',
  },
  resume: {
    from: ['paused'],
    to: 'active',
  },
  mark_past_due: {
    from: ['active'],
    to: 'past_due',
  },
  suspend: {
    from: ['trial', 'active', 'past_due', 'paused'],
    to: 'suspended',
  },
  cancel: {
    from: ['lead', 'trial', 'active', 'past_due', 'paused', 'suspended'],
    to: 'cancelled',
    apply: () => ({ cancelled_at: new Date() }),
  },
  reactivate: {
    from: ['cancelled', 'suspended', 'archived'],
    to: 'active',
    apply: () => ({ cancelled_at: null, archived_at: null }),
  },
  archive: {
    from: ['cancelled'],
    to: 'archived',
    apply: () => ({ archived_at: new Date() }),
  },
};

function fromNowDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

const transition = async (id, action, actor) => {
  const def = ACTIONS[action];
  if (!def) { const e = new Error(`Unknown lifecycle action "${action}".`); e.status = 400; throw e; }

  const tenantRes = await query(`SELECT * FROM tenants WHERE id = $1`, [id]);
  const tenant = tenantRes.rows[0];
  if (!tenant) { const e = new Error('Tenant not found'); e.status = 404; throw e; }

  if (!def.from.includes(tenant.status)) {
    const e = new Error(`Cannot "${action}" a tenant that is currently "${tenant.status}" (needs to be one of: ${def.from.join(', ')}).`);
    e.status = 400;
    throw e;
  }

  const extra = def.apply ? def.apply(tenant) : {};
  const fields = ['status = $1', 'updated_at = NOW()'];
  const params = [def.to];
  let idx = 2;
  for (const [key, value] of Object.entries(extra)) {
    fields.push(`${key} = $${idx++}`);
    params.push(value);
  }
  params.push(id);

  const res = await query(`UPDATE tenants SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, params);
  const updated = res.rows[0];
  delete updated.api_key;

  await audit.log({ superAdminId: actor?.id, tenantId: id, action: `tenant.${action}`, details: { from: tenant.status, to: def.to } });
  return updated;
};

// Daily job: trial tenants past trial_ends_at with no billing configured
// move to past_due (not straight to suspended -- gives a grace window and a
// clear "why is this red" reason on the dashboard) and are notified once.
// Trials ending within 3 days get a one-time "ending soon" notification.
const sweepTrials = async () => {
  const expired = await query(
    `UPDATE tenants SET status = 'past_due', updated_at = NOW()
     WHERE status = 'trial' AND trial_ends_at IS NOT NULL AND trial_ends_at < NOW()
     RETURNING id, name`
  );
  for (const t of expired.rows) {
    await audit.log({ tenantId: t.id, action: 'tenant.trial_expired' });
    await notifications.emit({ type: 'trial_ended', title: `Trial ended: ${t.name}`, message: 'Moved to past_due — no billing configured before trial end.', tenantId: t.id });
  }

  const endingSoon = await query(
    `UPDATE tenants SET trial_ending_notified_at = NOW()
     WHERE status = 'trial' AND trial_ends_at IS NOT NULL
       AND trial_ends_at BETWEEN NOW() AND NOW() + INTERVAL '3 days'
       AND trial_ending_notified_at IS NULL
     RETURNING id, name, trial_ends_at`
  );
  for (const t of endingSoon.rows) {
    await notifications.emit({ type: 'trial_ending', title: `Trial ending soon: ${t.name}`, message: `Ends ${new Date(t.trial_ends_at).toLocaleDateString()}.`, tenantId: t.id });
  }

  return { expired: expired.rows.length, endingSoon: endingSoon.rows.length };
};

// Daily job: cancelled tenants past their own retention_days move to
// archived automatically -- but archived never auto-deletes. Permanent
// deletion is a deliberate, separate, manual action (see deletePermanently).
const sweepRetention = async () => {
  const res = await query(
    `UPDATE tenants SET status = 'archived', archived_at = NOW(), updated_at = NOW()
     WHERE status = 'cancelled' AND cancelled_at < NOW() - (retention_days || ' days')::interval
     RETURNING id, name`
  );
  for (const t of res.rows) {
    await audit.log({ tenantId: t.id, action: 'tenant.archived', details: { reason: 'retention period elapsed' } });
  }
  return res.rows;
};

// Irreversible. Only ever called explicitly by a super admin against an
// already-archived tenant, never by a job. Deletes the Postgres row (and,
// via ON DELETE CASCADE, everything scoped to it -- invoices, payments,
// credits, etc.); does not touch the tenant's Firestore data, which is a
// separate, tenant-owned deletion decision.
const deletePermanently = async (id, actor) => {
  const tenantRes = await query(`SELECT id, name, status FROM tenants WHERE id = $1`, [id]);
  const tenant = tenantRes.rows[0];
  if (!tenant) { const e = new Error('Tenant not found'); e.status = 404; throw e; }
  if (tenant.status !== 'archived') {
    const e = new Error('Only an archived tenant can be permanently deleted.');
    e.status = 400;
    throw e;
  }
  await query(`DELETE FROM tenants WHERE id = $1`, [id]);
  await audit.log({ superAdminId: actor?.id, action: 'tenant.permanently_deleted', details: { tenant_id: id, name: tenant.name } });
};

module.exports = { ACTIONS, transition, sweepTrials, sweepRetention, deletePermanently };
