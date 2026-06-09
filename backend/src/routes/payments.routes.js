const { Router } = require('express');
const auth = require('../middleware/auth');
const {
  createPreference,
  webhook,
  getPaymentStatus,
  listPayments,
  saveSettings,
  getSettings,
} = require('../controllers/payments.controller');

const router = Router();

// Mercado Pago settings (per-business token)
router.get('/settings',  auth, getSettings);
router.post('/settings', auth, saveSettings);

// Create a payment preference (redirects patient to MP checkout)
router.post('/preference', auth, createPreference);

// Webhook from Mercado Pago — no auth, called server-to-server
router.post('/webhook', webhook);

// List all payments for the authenticated business
router.get('/', auth, listPayments);

// Get status of a single payment
router.get('/:paymentId', auth, getPaymentStatus);

module.exports = router;
