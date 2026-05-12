const router = require('express').Router();
const auth = require('../middleware/auth');
const { register, login, me, forgotPassword, resetPassword, logout } = require('../controllers/auth.controller');

router.post('/register', register);
router.post('/login', login);
router.get('/me', auth, me);
router.post('/logout', auth, logout);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;
