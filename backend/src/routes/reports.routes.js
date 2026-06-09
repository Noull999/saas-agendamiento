const { Router } = require('express');
const auth = require('../middleware/auth');
const { bookingsReport, patientReport } = require('../controllers/reports.controller');

const router = Router();
router.get('/bookings', auth, bookingsReport);
router.get('/patient/:id', auth, patientReport);
module.exports = router;
