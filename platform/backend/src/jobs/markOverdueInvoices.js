'use strict';

require('dotenv').config();
const { query } = require('../config/database');
const audit = require('../services/audit.service');

// Runs daily. Any issued invoice past its due date flips to overdue —
// purely a status marker for the super-admin dashboard, no dunning yet.
async function run() {
  const res = await query(
    `UPDATE invoices SET status = 'overdue'
     WHERE status = 'issued' AND due_at < NOW()
     RETURNING id, tenant_id, invoice_number`
  );

  for (const invoice of res.rows) {
    await audit.log({ tenantId: invoice.tenant_id, action: 'invoice.overdue', details: { invoice_number: invoice.invoice_number } });
    console.log(`[invoices] ${invoice.invoice_number} marked overdue.`);
  }

  return res.rows;
}

if (require.main === module) {
  run()
    .then((rows) => { console.log(`[invoices] Done. ${rows.length} invoice(s) marked overdue.`); process.exit(0); })
    .catch((err) => { console.error('[invoices] Overdue job failed:', err); process.exit(1); });
}

module.exports = { run };
