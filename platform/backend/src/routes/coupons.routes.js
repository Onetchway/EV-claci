'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/coupons.controller');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

router.use(authenticate);

router.get('/', ctrl.list);
router.post('/', requireRole('super_admin'), ctrl.create);
router.put('/:id', requireRole('super_admin'), ctrl.update);

router.get('/tenants/:tenantId', ctrl.listForTenant);
router.post('/tenants/:tenantId', requireRole('super_admin'), ctrl.assignToTenant);
router.delete('/tenants/:tenantId/:tenantCouponId', requireRole('super_admin'), ctrl.unassignFromTenant);

module.exports = router;
