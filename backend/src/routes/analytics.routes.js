const router = require('express').Router();
const auth = require('../middleware/auth');
const { requirePlan } = require('../middleware/plan');
const { getSummary } = require('../controllers/analytics.controller');

router.use(auth);
router.use(requirePlan('pro'));
router.get('/', getSummary);

module.exports = router;
