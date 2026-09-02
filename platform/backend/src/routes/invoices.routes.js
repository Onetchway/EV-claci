'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/invoices.controller');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

router.use(authenticate);

router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);
router.get('/tenants/:tenantId/preview', ctrl.preview);
router.post('/tenants/:tenantId/generate', requireRole('super_admin', 'billing_ops'), ctrl.generate);
router.patch('/:id/paid', requireRole('super_admin', 'billing_ops'), ctrl.markPaid);
router.patch('/:id/void', requireRole('super_admin'), ctrl.void);
router.post('/:id/resend-email', requireRole('super_admin', 'billing_ops'), ctrl.resendEmail);

module.exports = router;
