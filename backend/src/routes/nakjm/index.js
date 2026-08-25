'use strict';

const router = require('express').Router();

router.use('/clients',    require('./clients.routes'));
router.use('/vendors',    require('./vendors.routes'));
router.use('/team',       require('./team.routes'));
router.use('/projects',   require('./projects.routes'));
router.use('/quotations', require('./quotations.routes'));
router.use('/boq',        require('./boq.routes'));
router.use('/po',         require('./purchaseOrders.routes'));
router.use('/pi',         require('./proformaInvoices.routes'));
router.use('/payments',   require('./payments.routes'));
router.use('/reports',    require('./siteReports.routes'));
router.use('/documents',  require('./documents.routes'));
router.use('/dashboard',  require('./dashboard.routes'));

module.exports = router;
