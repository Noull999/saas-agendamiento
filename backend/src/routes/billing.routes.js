const router = require('express').Router();
const auth   = require('../middleware/auth');
const ctrl   = require('../controllers/billing.controller');

// NOTA: POST /webhook está registrado en index.js ANTES de express.json()
// para recibir el body en crudo (Buffer) que Stripe requiere para verificar la firma.

// Planes públicos (sin auth)
router.get('/plans', ctrl.getPlans);

// Checkout — requiere estar autenticado
router.post('/checkout', auth, ctrl.createCheckout);

module.exports = router;
