'use strict';

const cron = require('node-cron');
const jobs = require('../services/jobs.service');

function start() {
  const hour = parseInt(process.env.INVOICE_JOB_HOUR || '2', 10);
  // Every day at the configured hour: bill tenants due today, sweep any
  // previously-issued invoice that's now past due, then flag any overdue
  // invoice with no active payment attempt. Each run goes through
  // jobs.service's runJob so the Jobs page has a real history regardless
  // of whether it fired on schedule or was triggered manually.
  cron.schedule(`0 ${hour} * * *`, async () => {
    console.log('[scheduler] Running daily invoice generation...');
    for (const jobName of ['invoice_generation', 'mark_overdue_invoices', 'payment_retry']) {
      try {
        await jobs.runJob(jobName, 'scheduled');
      } catch (err) {
        console.error(`[scheduler] ${jobName} failed:`, err.message);
      }
    }
  });
  console.log(`[scheduler] Automatic invoice generation + overdue sweep + payment-retry flagging scheduled daily at ${hour}:00.`);
}

module.exports = { start };
