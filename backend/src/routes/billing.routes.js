const router = require('express').Router();
const auth   = require('../middleware/auth');
const ctrl   = require('../controllers/billing.controller');

// Planes públicos (sin auth)
router.get('/plans', ctrl.getPlans);

// Checkout de suscripción Mercado Pago — requiere estar autenticado
router.post('/checkout', auth, ctrl.createCheckout);

// Confirmar suscripción al volver de MP (?preapproval_id=...)
router.post('/confirm', auth, ctrl.confirmSubscription);

// Webhook de Mercado Pago (subscription_preapproval) — sin auth, server-to-server
router.post('/webhook', ctrl.webhook);

module.exports = router;
