'use strict';

const router = require('express').Router();
const ctrl   = require('../../controllers/nakjm/payments.controller');
const { authenticate } = require('../../middleware/auth');
const { authorize }    = require('../../middleware/rbac');

router.use(authenticate);

router.get('/client',        authorize('ADMIN', 'OPERATIONS', 'FINANCE'), ctrl.listClientPayments);
router.post('/client',       authorize('ADMIN', 'FINANCE'), ctrl.createClientPayment);
router.delete('/client/:id', authorize('ADMIN', 'FINANCE'), ctrl.removeClientPayment);

router.get('/vendor',        authorize('ADMIN', 'OPERATIONS', 'FINANCE'), ctrl.listVendorPayments);
router.post('/vendor',       authorize('ADMIN', 'FINANCE'), ctrl.createVendorPayment);
router.delete('/vendor/:id', authorize('ADMIN', 'FINANCE'), ctrl.removeVendorPayment);

module.exports = router;
