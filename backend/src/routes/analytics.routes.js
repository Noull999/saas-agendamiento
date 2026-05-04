const router = require('express').Router();
const auth = require('../middleware/auth');
const { getSummary } = require('../controllers/analytics.controller');

router.use(auth);
router.get('/', getSummary);

module.exports = router;
