'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/usage.controller');
const { authenticateTenant } = require('../middleware/tenantAuth');
const { authenticate } = require('../middleware/auth');

// Tenant self-report — auth is the tenant's own API key, not a super-admin session.
router.post('/report', authenticateTenant, ctrl.report);
router.put('/employees', authenticateTenant, ctrl.reportEmployees);

// Super admin reading what was reported (billing purposes only — a count, never who).
router.get('/tenants/:tenantId', authenticate, ctrl.listForTenant);

module.exports = router;
