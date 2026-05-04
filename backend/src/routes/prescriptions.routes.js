const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/prescriptions.controller');

router.use(auth);
router.post('/', ctrl.create);
router.get('/:id/pdf', ctrl.downloadPdf);
router.get('/:id', ctrl.getById);

module.exports = router;
