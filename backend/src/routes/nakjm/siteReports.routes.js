'use strict';

const router = require('express').Router();
const ctrl   = require('../../controllers/nakjm/siteReports.controller');
const { authenticate } = require('../../middleware/auth');
const { authorize }    = require('../../middleware/rbac');

router.use(authenticate);

router.get('/',       authorize('ADMIN', 'OPERATIONS', 'FINANCE'), ctrl.list);
router.post('/',      authorize('ADMIN', 'OPERATIONS'), ctrl.create);
router.delete('/:id', authorize('ADMIN', 'OPERATIONS'), ctrl.remove);

module.exports = router;
