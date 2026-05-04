const router = require('express').Router();
const auth = require('../middleware/auth');
const { list, upsert, remove } = require('../controllers/schedules.controller');

router.use(auth);
router.get('/', list);
router.post('/', upsert);
router.delete('/:dow', remove);

module.exports = router;
