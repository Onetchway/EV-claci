'use strict';

require('dotenv').config();
const { query } = require('../config/database');
const notifications = require('../services/notifications.service');
const paymentsService = require('./../services/payments.service');
const invoicesService = require('../services/invoices.service');

/**
 * Runs daily, for every overdue invoice with no pending payment attempt.
 * A tenant with a saved card on file (see payments.service.js's
 * chargeSavedMethod / tenant_payment_methods) gets a real retry charge
 * attempt; everything else still just gets flagged as a notification so a
 * super admin follows up (send a payment link, call the tenant) instead of
 * it silently sitting overdue forever. The saved-card path shares
 * chargeSavedMethod's own caveat: it cannot be exercised against a live
 * Razorpay gateway in this environment.
 */
async function run() {
  const res = await query(
    `SELECT i.*, t.name AS tenant_name
     FROM invoices i
     JOIN tenants t ON t.id = i.tenant_id
     WHERE i.status = 'overdue'
       AND NOT EXISTS (
         SELECT 1 FROM payments p WHERE p.invoice_id = i.id AND p.status IN ('created', 'paid')
       )`
  );

  for (const inv of res.rows) {
    const tenantRes = await query(`SELECT * FROM tenants WHERE id = $1`, [inv.tenant_id]);
    const invoice = await invoicesService.getOne(inv.id);
    const chargeResult = await paymentsService.chargeSavedMethod(invoice, tenantRes.rows[0]).catch((err) => ({ attempted: true, ok: false, reason: err.message }));

    if (chargeResult.attempted && chargeResult.ok) continue; // charge is in flight or captured -- no need to also notify

    await notifications.emit({
      type: 'payment_retry_needed',
      title: `Overdue invoice needs follow-up: ${inv.invoice_number}`,
      message: chargeResult.attempted
        ? `${inv.tenant_name} — ${inv.currency} ${inv.total_amount} overdue; auto-charge failed (${chargeResult.reason}).`
        : `${inv.tenant_name} — ${inv.currency} ${inv.total_amount} overdue with no active payment attempt.`,
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
