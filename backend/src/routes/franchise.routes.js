'use strict';

const router = require('express').Router();
const ctrl   = require('../controllers/franchise.controller');
const { authenticate } = require('../middleware/auth');
const { authorize }    = require('../middleware/rbac');

router.use(authenticate);

// The franchise partner's own portal: a "franchise"-role user's dashboard
// for their own franchise_id, no :id param needed (and no way to pass
// someone else's — see franchise.controller.js's portalDashboard).
router.get('/portal/dashboard', ctrl.portalDashboard);

router.get('/',              authorize('ADMIN', 'FINANCE'), ctrl.list);
router.post('/',             authorize('ADMIN'), ctrl.create);
router.get('/:id/dashboard', ctrl.franchiseDashboard);
router.get('/:id',           ctrl.getOne);
router.put('/:id',           authorize('ADMIN'), ctrl.update);
router.delete('/:id',        authorize('ADMIN'), ctrl.remove);

module.exports = router;
