const router = require('express').Router();
const auth = require('../middleware/auth');
const {
  connectGoogle,
  googleCallback,
  disconnectGoogle,
  getStatus,
} = require('../controllers/integrations.controller');

router.get('/google/auth', auth, connectGoogle);
router.get('/google/callback', googleCallback); // sin auth — callback de OAuth de Google
router.post('/google/disconnect', auth, disconnectGoogle);
router.get('/google/status', auth, getStatus);

module.exports = router;
