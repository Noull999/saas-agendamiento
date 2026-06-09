const { withRetry } = require('../lib/retry');

/**
 * Sends an SMS via Twilio REST API (no SDK dependency needed at runtime,
 * but uses the same credentials as WhatsApp).
 *
 * Returns true on success, false if not configured or on error.
 */
async function sendSMS({ to, body }) {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from  = process.env.TWILIO_SMS_FROM;

  if (!sid || !token) {
    console.warn('[sms] TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN no configurados, SMS no enviado');
    return false;
  }
  if (!from) {
    console.warn('[sms] TWILIO_SMS_FROM no configurado, SMS no enviado');
    return false;
  }
  if (!to) {
    console.warn('[sms] Teléfono del destinatario vacío, SMS no enviado');
    return false;
  }

  // Normalize Chilean phone: 9XXXXXXXX → +569XXXXXXXX
  let normalizedTo = to.replace(/\s/g, '');
  if (!normalizedTo.startsWith('+')) {
    if (normalizedTo.startsWith('9') && normalizedTo.length === 9) {
      normalizedTo = `+56${normalizedTo}`;
    } else if (normalizedTo.startsWith('56')) {
      normalizedTo = `+${normalizedTo}`;
    } else {
      normalizedTo = `+${normalizedTo}`;
    }
  }

  const credentials = Buffer.from(`${sid}:${token}`).toString('base64');

  try {
    const resp = await withRetry(
      () => fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ From: from, To: normalizedTo, Body: body }).toString(),
          signal: AbortSignal.timeout(8000),
        }
      ),
      3,
      1500
    );

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Twilio ${resp.status}: ${errText}`);
    }

    console.log(`[sms] SMS enviado a ${normalizedTo}`);
    return true;
  } catch (err) {
    console.error('[sms] Error enviando SMS:', err.message);
    return false;
  }
}

module.exports = { sendSMS };
