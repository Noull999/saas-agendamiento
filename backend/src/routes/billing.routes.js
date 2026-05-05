const router  = require('express').Router();
const express = require('express');
const auth    = require('../middleware/auth');
const ctrl    = require('../controllers/billing.controller');

// El webhook de Stripe necesita el body en crudo (sin parsear como JSON)
// Se registra ANTES del middleware de auth
router.post('/webhook', express.raw({ type: 'application/json' }), ctrl.webhook);

// Planes públicos (no requiere auth)
router.get('/plans', ctrl.getPlans);

// Checkout requiere estar autenticado
router.post('/checkout', auth, ctrl.createCheckout);

module.exports = router;
