const router = require('express').Router();

router.use('/auth',          require('./auth.routes'));
router.use('/dashboard',     require('./dashboard.routes'));
router.use('/tenants',       require('./tenants.routes'));
router.use('/features',      require('./features.routes'));
router.use('/billing-plans', require('./billingPlans.routes'));
router.use('/invoices',      require('./invoices.routes'));
router.use('/usage',         require('./usage.routes'));

module.exports = router;
