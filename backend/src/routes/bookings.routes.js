const router = require('express').Router();
const auth = require('../middleware/auth');
const { list, create, updateStatus, remove, publicCreate, updateBooking } = require('../controllers/bookings.controller');

// Rutas protegidas (dashboard del negocio)
router.get('/', auth, list);
router.post('/', auth, create);
router.patch('/:id/status', auth, updateStatus);
router.delete('/:id', auth, remove);
router.put('/:id', auth, updateBooking);

// Ruta pública (página de reservas del cliente)
router.post('/public/:slug', publicCreate);

module.exports = router;
