'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/admins.controller');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

router.use(authenticate);
router.use(requireRole('super_admin'));

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);

module.exports = router;
