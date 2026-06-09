const { withRetry } = require('../lib/retry');
const { getTemplate, renderTemplate } = require('./messageTemplates');

function formatDatetime(isoString) {
  const d = new Date(isoString);
  const date = d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
  const time = d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  return `${date} a las ${time}`;
}

// Llama a la API REST de Twilio directamente (sin SDK) si las variables están configuradas
async function sendViaTwilio(toPhone, body) {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from  = process.env.TWILIO_WHATSAPP_FROM;
  if (!sid || !token || !from) return false;

  const credentials = Buffer.from(`${sid}:${token}`).toString('base64');
  const resp = await withRetry(
    () => fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: `whatsapp:${from}`,
          To:   `whatsapp:${toPhone}`,
          Body: body,
        }).toString(),
        signal: AbortSignal.timeout(8000),
      }
    ),
    3,
    1500
  );
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Twilio ${resp.status}: ${err}`);
  }
  return true;
}

// Llama al bot propio si WHATSAPP_BOT_URL está configurado
async function sendViaBot(payload) {
  const botUrl = process.env.WHATSAPP_BOT_URL;
  if (!botUrl) return false;

  const secret  = process.env.WHATSAPP_BOT_SECRET;
  const headers = { 'Content-Type': 'application/json' };
  if (secret) headers['Authorization'] = `Bearer ${secret}`;

  await withRetry(
    () => fetch(`${botUrl}/notify`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    }),
    3,
    1500
  );
  return true;
}

// Notificación inmediata al crear una reserva
async function notifyBooking({ clientName, clientPhone, clientEmail, serviceName, datetimeISO, businessName, businessId, cancelToken, frontendUrl }) {
  const d = new Date(datetimeISO);
  const date = d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
  const time = d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  const baseUrl = frontendUrl || process.env.FRONTEND_URL || 'http://localhost:5173';
  const cancelLink = cancelToken ? `${baseUrl}/cancel/${cancelToken}` : '';

  const vars = {
    clientName,
    businessName,
    serviceName: serviceName || 'General',
    date,
    time,
    cancelLink,
  };

  const template = await getTemplate(businessId, 'booking_confirmation', 'whatsapp');
  const message = renderTemplate(template, vars);

  // Twilio tiene prioridad; si no, usa el bot propio
  if (clientPhone) {
    const sent = await sendViaTwilio(clientPhone, message).catch(() => false);
    if (sent) return;
  }

  const datetime = formatDatetime(datetimeISO);
  await sendViaBot({
    name: clientName, phone: clientPhone || '', clientEmail: clientEmail || '',
    service: serviceName || '', datetime, datetimeISO, businessName,
  }).catch(() => {});
}

// Recordatorio 24h antes — llamado por el cron job
async function notifyReminder({ clientName, clientPhone, serviceName, datetimeISO, businessName, businessId }) {
  if (!clientPhone) return;
  const d = new Date(datetimeISO);
  const date = d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
  const time = d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });

  const vars = {
    clientName,
    businessName,
    serviceName: serviceName || 'General',
    date,
    time,
    cancelLink: '',
  };

  const template = await getTemplate(businessId, 'reminder', 'whatsapp');
  const message = renderTemplate(template, vars);

  const sent = await sendViaTwilio(clientPhone, message).catch(() => false);
  if (sent) return;

  const datetime = formatDatetime(datetimeISO);
  await sendViaBot({
    name: clientName, phone: clientPhone, service: serviceName || '',
    datetime, datetimeISO, businessName, type: 'reminder',
  }).catch(() => {});
}

module.exports = { notifyBooking, notifyReminder };
