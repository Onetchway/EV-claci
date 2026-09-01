'use strict';

const cron = require('node-cron');
const { run: generateInvoices } = require('./generateInvoices');
const { run: markOverdueInvoices } = require('./markOverdueInvoices');

function start() {
  const hour = parseInt(process.env.INVOICE_JOB_HOUR || '2', 10);
  // Every day at the configured hour: bill tenants due today, then sweep
  // any previously-issued invoice that's now past its due date.
  cron.schedule(`0 ${hour} * * *`, async () => {
    console.log('[scheduler] Running daily invoice generation...');
    try {
      await generateInvoices();
    } catch (err) {
      console.error('[scheduler] Invoice generation failed:', err);
    }
    try {
      await markOverdueInvoices();
    } catch (err) {
      console.error('[scheduler] Marking overdue invoices failed:', err);
    }
  });
  console.log(`[scheduler] Automatic invoice generation + overdue sweep scheduled daily at ${hour}:00.`);
}

module.exports = { start };
