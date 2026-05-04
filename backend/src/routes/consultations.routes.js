const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/consultations.controller');

router.use(auth);
router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.get('/:id', ctrl.getById);
router.put('/:id', ctrl.update);

module.exports = router;
