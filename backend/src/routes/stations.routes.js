const router = require('express').Router();
const ctrl   = require('../controllers/stations.controller');
const { authenticate } = require('../middleware/auth');
const { authorize }    = require('../middleware/rbac');

router.use(authenticate);

router.get('/',          ctrl.list);
router.post('/',         authorize('ADMIN', 'OPERATIONS'), ctrl.create);
router.get('/:id',       ctrl.getOne);
router.put('/:id',       authorize('ADMIN', 'OPERATIONS'), ctrl.update);
router.delete('/:id',    authorize('ADMIN'), ctrl.remove);
router.get('/:id/stats', ctrl.stats);

module.exports = router;
