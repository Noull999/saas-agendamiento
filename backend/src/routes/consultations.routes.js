const router = require('express').Router();
const auth = require('../middleware/auth');
const { requirePlan } = require('../middleware/plan');
const ctrl = require('../controllers/consultations.controller');

router.use(auth);
router.use(requirePlan('pro'));
router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.get('/:id', ctrl.getById);
router.put('/:id', ctrl.update);

module.exports = router;
