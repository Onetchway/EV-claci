'use strict';

const { query } = require('../config/database');
const generateInvoices = require('../jobs/generateInvoices');
const markOverdueInvoices = require('../jobs/markOverdueInvoices');
const retryFailedPayments = require('../jobs/retryFailedPayments');
const lifecycle = require('./lifecycle.service');

// Registry of every background job the Jobs page shows -- name, what it
// does, and the function that actually runs it (used by both the daily
// cron in jobs/scheduler.js and this service's manual "Run now").
const REGISTRY = {
  invoice_generation: { label: 'Monthly Billing / Invoice Generation', run: generateInvoices.run },
  mark_overdue_invoices: { label: 'Mark Overdue Invoices', run: markOverdueInvoices.run },
  payment_retry: { label: 'Payment Retry', run: retryFailedPayments.run },
  trial_sweep: { label: 'Trial Expiry / Ending-Soon Sweep', run: lifecycle.sweepTrials },
  retention_sweep: { label: 'Cancelled → Archived Retention Sweep', run: lifecycle.sweepRetention },
};

// Wraps a job's run() with a job_runs row -- both scheduled (cron) and
// manual ("Run now") executions go through this so the Jobs page has one
// consistent history regardless of trigger.
const runJob = async (jobName, trigger = 'scheduled') => {
  const def = REGISTRY[jobName];
  if (!def) { const e = new Error(`Unknown job "${jobName}".`); e.status = 404; throw e; }

  const startRes = await query(
    `INSERT INTO job_runs (job_name, status, trigger) VALUES ($1,'running',$2) RETURNING id`,
    [jobName, trigger]
  );
  const runId = startRes.rows[0].id;

  try {
    const result = await def.run();
    await query(
      `UPDATE job_runs SET status='succeeded', result_summary=$1, finished_at=NOW() WHERE id=$2`,
      [JSON.stringify({ count: Array.isArray(result) ? result.length : undefined }), runId]
    );
    return { ok: true, result };
  } catch (err) {
    await query(`UPDATE job_runs SET status='failed', error=$1, finished_at=NOW() WHERE id=$2`, [err.message, runId]);
    throw err;
  }
};

// One row per registered job: its most recent run (if any) plus label.
const listWithLastRun = async () => {
  const res = await query(
    `SELECT DISTINCT ON (job_name) job_name, status, trigger, started_at, finished_at, error
     FROM job_runs ORDER BY job_name, started_at DESC`
  );
  const lastRunByName = Object.fromEntries(res.rows.map((r) => [r.job_name, r]));
  return Object.entries(REGISTRY).map(([name, def]) => ({
    name, label: def.label, last_run: lastRunByName[name] || null,
  }));
};

const history = async (jobName, limit = 20) => {
  const res = await query(
    `SELECT * FROM job_runs WHERE job_name = $1 ORDER BY started_at DESC LIMIT $2`,
    [jobName, Math.min(limit, 100)]
  );
  return res.rows;
};

module.exports = { REGISTRY, runJob, listWithLastRun, history };
