const router = require('express').Router();
const auth = require('../middleware/auth');
const { requirePlan } = require('../middleware/plan');
const { getSummary, getCommissions } = require('../controllers/analytics.controller');

router.use(auth);
router.use(requirePlan('pro'));
router.get('/', getSummary);
router.get('/commissions', getCommissions);

module.exports = router;
