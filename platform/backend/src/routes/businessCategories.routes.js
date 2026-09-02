'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/businessCategories.controller');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', ctrl.list);
router.get('/:key/recommendations', ctrl.recommendations);

module.exports = router;
