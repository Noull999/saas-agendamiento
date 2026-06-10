const crypto = require('crypto');

/**
 * Verifica la firma x-signature de un webhook de Mercado Pago.
 *
 * MP firma un "manifest" con HMAC-SHA256 usando el secret del webhook:
 *   id:<data.id>;request-id:<x-request-id>;ts:<ts>;
 *
 * Docs: https://www.mercadopago.cl/developers/es/docs/your-integrations/notifications/webhooks
 *
 * Comportamiento:
 *  - Si MERCADO_PAGO_WEBHOOK_SECRET no está configurado: devuelve true y
 *    registra una advertencia (no rompe producción antes de configurarlo;
 *    el re-fetch a la API de MP sigue siendo la protección principal).
 *  - Si está configurado: valida la firma y rechaza las inválidas.
 *
 * @param {import('express').Request} req
 * @param {string|number} dataId  El data.id del recurso (payment/preapproval)
 * @returns {boolean} true si la firma es válida o no hay secret configurado
 */
function verifyMpSignature(req, dataId) {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  if (!secret) {
    console.warn('[mp] MERCADO_PAGO_WEBHOOK_SECRET no configurado — firma no verificada');
    return true;
  }

  const signature = req.headers['x-signature'];
  const requestId = req.headers['x-request-id'];
  if (!signature || typeof signature !== 'string') return false;

  // x-signature: "ts=1704908010,v1=hexdigest"
  const parts = Object.fromEntries(
    signature.split(',').map(kv => {
      const [k, v] = kv.split('=');
      return [k?.trim(), v?.trim()];
    })
  );
  const ts = parts.ts;
  const hash = parts.v1;
  if (!ts || !hash) return false;

  // El id va en minúsculas en el manifest
  const id = String(dataId).toLowerCase();
  const manifest = `id:${id};request-id:${requestId};ts:${ts};`;

  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

  // Comparación en tiempo constante
  try {
    const a = Buffer.from(hash, 'hex');
    const b = Buffer.from(expected, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

module.exports = { verifyMpSignature };
