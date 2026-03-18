const router = require('express').Router();
const ctrl   = require('../controllers/bss.controller');
const { authenticate } = require('../middleware/auth');
const { authorize }    = require('../middleware/rbac');

router.use(authenticate);

router.get('/',            ctrl.list);
router.post('/',           authorize('ADMIN', 'OPERATIONS'), ctrl.create);
router.get('/:id',         ctrl.getOne);
router.put('/:id',         authorize('ADMIN', 'OPERATIONS'), ctrl.update);
router.delete('/:id',      authorize('ADMIN'), ctrl.remove);
router.post('/:id/usage',  authorize('ADMIN', 'OPERATIONS'), ctrl.recordUsage);
router.get('/:id/usage',   ctrl.getUsage);

module.exports = router;
