const router = require('express').Router();
const auth = require('../middleware/auth');
const { getProfile, updateProfile } = require('../controllers/settings.controller');

router.use(auth);
router.get('/', getProfile);
router.put('/', updateProfile);

module.exports = router;
