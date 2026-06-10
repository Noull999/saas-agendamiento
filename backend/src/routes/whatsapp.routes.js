const router = require('express').Router();
const express = require('express');
const { handleIncoming } = require('../services/whatsappBot');

// Twilio envía los webhooks como application/x-www-form-urlencoded.
// Este parser aplica solo a estas rutas (el global usa express.json()).
const urlencoded = express.urlencoded({ extended: false });

function escapeXml(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function twiml(message) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`;
}

// POST /api/whatsapp/incoming — webhook de Twilio para mensajes entrantes
router.post('/incoming', urlencoded, async (req, res) => {
  try {
    const from = (req.body.From || '').replace(/^whatsapp:/, '').trim();
    const body = req.body.Body || '';
    if (!from) {
      res.type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
      return;
    }
    const reply = await handleIncoming(from, body);
    res.type('text/xml').send(twiml(reply));
  } catch (err) {
    console.error('[whatsapp] webhook error:', err.message);
    res.type('text/xml').send(twiml('Ocurrió un error. Intenta de nuevo más tarde.'));
  }
});

module.exports = router;
