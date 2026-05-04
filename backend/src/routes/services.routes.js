const router = require('express').Router();
const auth = require('../middleware/auth');
const { list, create, update, remove } = require('../controllers/services.controller');

router.use(auth);
router.get('/', list);
router.post('/', create);
router.put('/:id', update);
router.delete('/:id', remove);

module.exports = router;
