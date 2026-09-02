'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/modules.controller');
const { authenticate } = require('../middleware/auth');
const { authenticateTenant } = require('../middleware/tenantAuth');
const { requireRole } = require('../middleware/role');

// Tenant-authenticated — mirrors features.routes.js's own /me exactly.
router.get('/me', authenticateTenant, ctrl.listForSelf);

router.use(authenticate);

router.get('/catalog', ctrl.listCatalog);
router.put('/catalog/:key', requireRole('super_admin'), ctrl.updateCatalog);
router.get('/tenants/:tenantId', ctrl.listForTenant);
router.put('/tenants/:tenantId', requireRole('super_admin'), ctrl.bulkSetForTenant);
router.put('/tenants/:tenantId/:moduleKey', requireRole('super_admin'), ctrl.setForTenant);

module.exports = router;
