'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/usage.controller');
const { authenticateTenant } = require('../middleware/tenantAuth');
const { authenticate } = require('../middleware/auth');

// Tenant self-report — auth is the tenant's own API key, not a super-admin session.
router.post('/report', authenticateTenant, ctrl.report);

// Super admin reading the reported counts (billing purposes only).
router.get('/tenants/:tenantId', authenticate, ctrl.listForTenant);

module.exports = router;
