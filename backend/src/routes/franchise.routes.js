const router = require('express').Router();
const ctrl   = require('../controllers/franchise.controller');
const { authenticate } = require('../middleware/auth');
const { authorize }    = require('../middleware/rbac');

router.use(authenticate);

router.get('/',       ctrl.list);
router.post('/',      authorize('ADMIN'), ctrl.create);
router.get('/:id',    ctrl.getOne);
router.put('/:id',    authorize('ADMIN'), ctrl.update);
router.delete('/:id', authorize('ADMIN'), ctrl.remove);
router.get('/:id/dashboard', ctrl.franchiseDashboard);

module.exports = router;
