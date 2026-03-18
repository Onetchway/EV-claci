const router = require('express').Router();
const ctrl   = require('../controllers/users.controller');
const { authenticate } = require('../middleware/auth');
const { authorize }    = require('../middleware/rbac');

router.use(authenticate);

router.get('/',         authorize('ADMIN'), ctrl.list);
router.get('/:id',      authorize('ADMIN'), ctrl.getOne);
router.put('/:id',      authorize('ADMIN'), ctrl.update);
router.delete('/:id',   authorize('ADMIN'), ctrl.remove);

module.exports = router;
