const router = require('express').Router();
const auth = require('../middleware/auth');
const { register, login, me } = require('../controllers/auth.controller');

router.post('/register', register);
router.post('/login', login);
router.get('/me', auth, me);

module.exports = router;
