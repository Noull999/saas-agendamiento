const router = require('express').Router();
const auth = require('../middleware/auth');
const { getProfile, updateProfile, getTemplates, updateTemplate } = require('../controllers/settings.controller');

router.use(auth);
router.get('/', getProfile);
router.put('/', updateProfile);
router.get('/templates', getTemplates);
router.put('/templates', updateTemplate);

module.exports = router;
