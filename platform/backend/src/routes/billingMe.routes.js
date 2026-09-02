'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/billingMe.controller');
const { authenticateTenant } = require('../middleware/tenantAuth');

// Everything here is a tenant's own CRM reading its own billing state --
// auth is the tenant's own API key (X-Tenant-Api-Key), never a super-admin
// session. See spec section 60: a tenant sees its own plan, invoices and
// receipts, nothing about any other tenant.
router.use(authenticateTenant);

router.get('/me', ctrl.overview);
router.get('/me/invoices', ctrl.listInvoices);
router.get('/me/invoices/:invoiceId/receipt', ctrl.invoiceReceipt);

module.exports = router;
