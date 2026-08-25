'use strict';

const router = require('express').Router();
const ctrl   = require('../../controllers/nakjm/dashboard.controller');
const { authenticate } = require('../../middleware/auth');
const { authorize }    = require('../../middleware/rbac');

router.use(authenticate);

router.get('/', authorize('ADMIN', 'OPERATIONS', 'FINANCE'), ctrl.overview);

module.exports = router;
