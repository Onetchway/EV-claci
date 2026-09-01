'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/features.controller');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

router.use(authenticate);

router.get('/catalog', ctrl.listCatalog);
router.get('/tenants/:tenantId', ctrl.listForTenant);
router.put('/tenants/:tenantId', requireRole('super_admin'), ctrl.bulkSetForTenant);
router.put('/tenants/:tenantId/:featureKey', requireRole('super_admin'), ctrl.setForTenant);

module.exports = router;
