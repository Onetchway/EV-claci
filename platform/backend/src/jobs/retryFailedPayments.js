'use strict';

require('dotenv').config();
const { query } = require('../config/database');
const notifications = require('../services/notifications.service');

/**
 * Runs daily. This platform has no stored payment method / auto-charge yet
 * (spec section 41's "Payment methods" and "Auto-charge" aren't built) --
 * so this job can't actually re-attempt a charge. What it *can* do
 * honestly: surface every overdue invoice with no pending payment attempt
 * as an in-app notification, so a super admin follows up (send a payment
 * link, call the tenant) instead of it silently sitting overdue forever.
 */
async function run() {
  const res = await query(
    `SELECT i.id, i.invoice_number, i.total_amount, i.currency, i.tenant_id, t.name AS tenant_name
     FROM invoices i
     JOIN tenants t ON t.id = i.tenant_id
     WHERE i.status = 'overdue'
       AND NOT EXISTS (
         SELECT 1 FROM payments p WHERE p.invoice_id = i.id AND p.status IN ('created', 'paid')
       )`
  );

  for (const inv of res.rows) {
    await notifications.emit({
      type: 'payment_retry_needed',
      title: `Overdue invoice needs follow-up: ${inv.invoice_number}`,
      message: `${inv.tenant_name} — ${inv.currency} ${inv.total_amount} overdue with no active payment attempt.`,
      tenantId: inv.tenant_id,
    });
  }

  return res.rows;
}

if (require.main === module) {
  run()
    .then((rows) => { console.log(`[payment-retry] Done. ${rows.length} overdue invoice(s) flagged.`); process.exit(0); })
    .catch((err) => { console.error('[payment-retry] Job failed:', err); process.exit(1); });
}

module.exports = { run };
