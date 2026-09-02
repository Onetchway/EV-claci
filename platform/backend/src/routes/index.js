const router = require('express').Router();

router.use('/auth',          require('./auth.routes'));
router.use('/admins',        require('./admins.routes'));
router.use('/dashboard',     require('./dashboard.routes'));
router.use('/tenants',       require('./tenants.routes'));
router.use('/features',      require('./features.routes'));
router.use('/modules',       require('./modules.routes'));
router.use('/add-ons',       require('./addOns.routes'));
router.use('/coupons',       require('./coupons.routes'));
router.use('/credits',       require('./credits.routes'));
router.use('/billing-plans', require('./billingPlans.routes'));
router.use('/invoices',      require('./invoices.routes'));
router.use('/payments',      require('./payments.routes'));
router.use('/ops',           require('./operations.routes'));
router.use('/usage',         require('./usage.routes'));
router.use('/provisioning',  require('./provisioning.routes'));
router.use('/billing',       require('./billingMe.routes'));

module.exports = router;
