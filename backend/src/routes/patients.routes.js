const router = require('express').Router();
const auth = require('../middleware/auth');
const { requirePlan } = require('../middleware/plan');
const ctrl = require('../controllers/patients.controller');

router.use(auth);
router.use(requirePlan('pro'));
router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.get('/:id/history', ctrl.history);
router.get('/:id/bookings', ctrl.clientBookings);
router.get('/:id/export', ctrl.exportData);
router.get('/:id', ctrl.getById);
router.put('/:id', ctrl.update);

module.exports = router;
