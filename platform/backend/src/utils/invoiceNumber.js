const { query } = require('../config/database');

// INV-YYYYMM-#### — sequential within the month, safe under concurrent generation
// because generateInvoices runs sequentially per tenant, not in parallel.
async function nextInvoiceNumber(periodStart) {
  const prefix = `INV-${periodStart.getFullYear()}${String(periodStart.getMonth() + 1).padStart(2, '0')}`;
  const res = await query(
    `SELECT invoice_number FROM invoices WHERE invoice_number LIKE $1 ORDER BY invoice_number DESC LIMIT 1`,
    [`${prefix}-%`]
  );
  const last = res.rows[0]?.invoice_number;
  const nextSeq = last ? parseInt(last.split('-')[2], 10) + 1 : 1;
  return `${prefix}-${String(nextSeq).padStart(4, '0')}`;
}

module.exports = { nextInvoiceNumber };
