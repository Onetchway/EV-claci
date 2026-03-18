const router = require('express').Router();

router.use('/auth',        require('./auth.routes'));
router.use('/users',       require('./users.routes'));
router.use('/stations',    require('./stations.routes'));
router.use('/assets',      require('./assets.routes'));
router.use('/chargers',    require('./chargers.routes'));
router.use('/bss',         require('./bss.routes'));
router.use('/franchises',  require('./franchise.routes'));
router.use('/sessions',    require('./sessions.routes'));
router.use('/revenue',     require('./revenue.routes'));
router.use('/settlements', require('./settlements.routes'));
router.use('/dashboard',   require('./dashboard.routes'));

module.exports = router;
