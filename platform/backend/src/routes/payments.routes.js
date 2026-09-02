'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/payments.controller');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

// Public, signature-verified -- see payments.controller.js's webhook.
router.post('/webhook', ctrl.webhook);

router.use(authenticate);

router.get('/invoices/:invoiceId', ctrl.listForInvoice);
router.post('/invoices/:invoiceId/order', requireRole('super_admin', 'billing_ops'), ctrl.createOrder);
router.post('/:id/refund', requireRole('super_admin', 'billing_ops'), ctrl.refund);
router.get('/:id/receipt', ctrl.receipt);

module.exports = router;
