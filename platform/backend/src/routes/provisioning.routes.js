'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/provisioning.controller');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

router.use(authenticate);

router.post('/tenants/:tenantId/isolated-database', requireRole('super_admin'), ctrl.provisionIsolatedDatabase);

module.exports = router;
