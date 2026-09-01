'use strict';

const cron = require('node-cron');
const { run: generateInvoices } = require('./generateInvoices');

function start() {
  const hour = parseInt(process.env.INVOICE_JOB_HOUR || '2', 10);
  // Every day at the configured hour, check for tenants due to be billed.
  cron.schedule(`0 ${hour} * * *`, async () => {
    console.log('[scheduler] Running daily invoice generation...');
    try {
      await generateInvoices();
    } catch (err) {
      console.error('[scheduler] Invoice generation failed:', err);
    }
  });
  console.log(`[scheduler] Automatic invoice generation scheduled daily at ${hour}:00.`);
}

module.exports = { start };
