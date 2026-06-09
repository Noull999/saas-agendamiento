const { Router } = require('express');
const auth = require('../middleware/auth');
const { createApiKey, listApiKeys, revokeApiKey } = require('../controllers/apiKeys.controller');

const router = Router();

router.get('/', auth, listApiKeys);
router.post('/', auth, createApiKey);
router.delete('/:id', auth, revokeApiKey);

module.exports = router;
