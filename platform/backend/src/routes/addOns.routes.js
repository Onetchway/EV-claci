'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/addOns.controller');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

router.use(authenticate);

router.get('/catalog', ctrl.listCatalog);
router.post('/catalog', requireRole('super_admin'), ctrl.createCatalog);
router.put('/catalog/:id', requireRole('super_admin'), ctrl.updateCatalog);
router.delete('/catalog/:id', requireRole('super_admin'), ctrl.removeCatalog);

router.get('/tenants/:tenantId', ctrl.listForTenant);
router.post('/tenants/:tenantId', requireRole('super_admin'), ctrl.attachToTenant);
router.delete('/tenants/:tenantId/:addOnId', requireRole('super_admin'), ctrl.detachFromTenant);

module.exports = router;
