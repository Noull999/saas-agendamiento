const db             = require('../db/database');
const { notifyReminder } = require('../services/whatsapp');

const INTERVAL_MS = 30 * 60 * 1000; // cada 30 minutos
let intervalId = null;

async function sendReminders() {
  const now  = Date.now();
  const from = new Date(now + 23 * 60 * 60 * 1000).toISOString();
  const to   = new Date(now + 25 * 60 * 60 * 1000).toISOString();

  let bookings;
  try {
    const { rows } = await db.query(`
      SELECT b.id, b.client_name, b.client_phone, b.client_email,
             b.datetime_iso, s.name AS service_name, bs.name AS business_name
      FROM   bookings b
      LEFT JOIN services    s  ON b.service_id   = s.id
      LEFT JOIN businesses  bs ON b.business_id  = bs.id
      WHERE  b.reminded = 0
        AND  b.status   = 'confirmed'
        AND  (
          CASE WHEN b.datetime_iso ~ 'T.*[Z+\\-][0-9]'
               THEN b.datetime_iso::timestamptz
               ELSE (b.datetime_iso || '-04:00')::timestamptz
          END
        ) >= $1::timestamptz
        AND  (
          CASE WHEN b.datetime_iso ~ 'T.*[Z+\\-][0-9]'
               THEN b.datetime_iso::timestamptz
               ELSE (b.datetime_iso || '-04:00')::timestamptz
          END
        ) <= $2::timestamptz
        AND  bs.plan IN ('pro', 'business')
    `, [from, to]);
    bookings = rows;
  } catch (err) {
    console.error('[reminders] Error al consultar bookings:', err.message);
    return;
  }

  for (const booking of bookings) {
    try {
      await notifyReminder({
        clientName:   booking.client_name,
        clientPhone:  booking.client_phone,
        clientEmail:  booking.client_email,
        serviceName:  booking.service_name,
        datetimeISO:  booking.datetime_iso,
        businessName: booking.business_name,
      });
      await db.query('UPDATE bookings SET reminded = 1 WHERE id = $1', [booking.id]);
      console.log(`[reminders] Recordatorio enviado: booking #${booking.id} (${booking.client_name})`);
    } catch (err) {
      console.error(`[reminders] Fallo en booking #${booking.id}:`, err.message);
    }
  }

  if (bookings.length > 0) {
    console.log(`[reminders] Ciclo completado: ${bookings.length} recordatorio(s) procesado(s)`);
  }
}

function startReminderJob() {
  sendReminders().catch(err => console.error('[reminders] Error inicial:', err.message));
  intervalId = setInterval(() => {
    sendReminders().catch(err => console.error('[reminders] Error en ciclo:', err.message));
  }, INTERVAL_MS);
  console.log('[reminders] Job iniciado — revisa recordatorios cada 30 min');
}

function stopReminderJob() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[reminders] Job detenido');
  }
}

module.exports = { startReminderJob, stopReminderJob };
