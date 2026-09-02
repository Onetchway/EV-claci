'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/credits.controller');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

router.use(authenticate);

router.get('/tenants/:tenantId', ctrl.listForTenant);
router.post('/tenants/:tenantId', requireRole('super_admin', 'billing_ops'), ctrl.addCredit);

module.exports = router;
