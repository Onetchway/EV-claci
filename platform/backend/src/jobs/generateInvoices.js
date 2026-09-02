'use strict';

require('dotenv').config();
const { query } = require('../config/database');
const invoicesService = require('../services/invoices.service');
const paymentsService = require('../services/payments.service');

// Runs daily. For every active tenant whose billing_day matches today,
// generates the invoice for the month that just ended — automatically,
// no super-admin action required.
async function run() {
  const today = new Date();
  const day = today.getDate();

  const res = await query(
    `SELECT id, name, billing_day FROM tenants WHERE status = 'active' AND billing_day = $1`,
    [day]
  );

  const periodStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const periodEnd = new Date(today.getFullYear(), today.getMonth(), 1);

  const results = [];
  for (const tenant of res.rows) {
    try {
      const invoice = await invoicesService.generateForTenant(tenant.id, periodStart, periodEnd, null);
      results.push({ tenant: tenant.name, invoice_number: invoice.invoice_number, total_amount: invoice.total_amount });
      console.log(`[invoices] Generated ${invoice.invoice_number} for ${tenant.name} (${invoice.total_amount})`);

      // Best-effort: if this tenant has a saved card on file, try to bill it
      // immediately rather than waiting for them to pay the link manually.
      // Never blocks invoice generation -- see chargeSavedMethod's own comment.
      const tenantRes = await query(`SELECT * FROM tenants WHERE id = $1`, [tenant.id]);
      const chargeResult = await paymentsService.chargeSavedMethod(invoice, tenantRes.rows[0]).catch((err) => ({ attempted: true, ok: false, reason: err.message }));
      if (chargeResult.attempted) {
        console.log(`[invoices] Auto-charge for ${invoice.invoice_number}: ${chargeResult.ok ? chargeResult.status : `failed (${chargeResult.reason})`}`);
      }
    } catch (err) {
      console.error(`[invoices] Failed to generate invoice for ${tenant.name}:`, err.message);
    }
  }
  return results;
}

if (require.main === module) {
  run()
    .then((results) => { console.log(`[invoices] Done. ${results.length} invoice(s) generated.`); process.exit(0); })
    .catch((err) => { console.error('[invoices] Job failed:', err); process.exit(1); });
}

module.exports = { run };
