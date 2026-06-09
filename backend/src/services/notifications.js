/**
 * notifications.js — Orchestration layer: WhatsApp first, SMS fallback.
 *
 * Covers the ~22% of Chilean users without WhatsApp by falling back to SMS
 * when WhatsApp is not configured or when a WhatsApp delivery fails.
 */

const { notifyBooking, notifyReminder } = require('./whatsapp');
const { sendSMS } = require('./sms');

/** Returns true if any WhatsApp channel is configured. */
function hasWhatsApp() {
  return !!(process.env.TWILIO_WHATSAPP_FROM || process.env.WHATSAPP_BOT_URL);
}

/** Returns true if SMS via Twilio is configured. */
function hasSMS() {
  return !!(process.env.TWILIO_SMS_FROM && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
}

/**
 * Sends a booking-confirmation notification.
 * Tries WhatsApp first; falls back to SMS if WhatsApp is not configured or fails.
 */
async function notifyBookingConfirmation({
  clientName,
  clientPhone,
  clientEmail,
  serviceName,
  datetimeISO,
  businessName,
  cancelToken,
  businessId,
}) {
  if (hasWhatsApp() && clientPhone) {
    try {
      await notifyBooking({
        clientName,
        clientPhone,
        clientEmail,
        serviceName,
        datetimeISO,
        businessName,
        businessId,
        cancelToken,
      });
      console.log('[notifications] Booking confirmation sent via WhatsApp');
      return;
    } catch (err) {
      console.warn('[notifications] WhatsApp falló, intentando SMS:', err.message);
    }
  }

  if (hasSMS() && clientPhone) {
    const d    = new Date(datetimeISO);
    const date = d.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' });
    const time = d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    const message = `${businessName}: Tu cita está confirmada para ${date} a las ${time}. Servicio: ${serviceName || 'Sin especificar'}.`;

    await sendSMS({ to: clientPhone, body: message });
    console.log('[notifications] Booking confirmation sent via SMS');
  }
}

/**
 * Sends a 24-hour reminder notification.
 * Tries WhatsApp first; falls back to SMS if WhatsApp is not configured or fails.
 */
async function notifyReminderNotification({
  clientName,
  clientPhone,
  clientEmail,
  serviceName,
  datetimeISO,
  businessName,
  businessId,
}) {
  if (hasWhatsApp() && clientPhone) {
    try {
      await notifyReminder({
        clientName,
        clientPhone,
        clientEmail,
        serviceName,
        datetimeISO,
        businessName,
        businessId,
      });
      console.log('[notifications] Reminder sent via WhatsApp');
      return;
    } catch (err) {
      console.warn('[notifications] WhatsApp reminder falló, intentando SMS:', err.message);
    }
  }

  if (hasSMS() && clientPhone) {
    const d    = new Date(datetimeISO);
    const time = d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    const message = `Recordatorio: Tienes cita mañana en ${businessName} a las ${time}. ${serviceName || ''}`.trim();

    await sendSMS({ to: clientPhone, body: message });
    console.log('[notifications] Reminder sent via SMS');
  }
}

module.exports = { notifyBookingConfirmation, notifyReminderNotification };
