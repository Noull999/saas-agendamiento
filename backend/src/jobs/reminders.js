/**
 * Job de recordatorios WhatsApp
 * Corre cada 30 minutos y envía un mensaje a clientes con citas en las próximas 23-25 horas.
 * La ventana de 2h (±1h alrededor de las 24h) evita duplicados aunque el job se desfase.
 */

const db             = require('../db/database');
const { notifyReminder } = require('../services/whatsapp');

const INTERVAL_MS = 30 * 60 * 1000; // cada 30 minutos

async function sendReminders() {
  const now  = Date.now();
  const from = new Date(now + 23 * 60 * 60 * 1000).toISOString(); // 23h desde ahora
  const to   = new Date(now + 25 * 60 * 60 * 1000).toISOString(); // 25h desde ahora

  let bookings;
  try {
    bookings = db.prepare(`
      SELECT b.id, b.client_name, b.client_phone, b.client_email,
             b.datetime_iso, s.name AS service_name, bs.name AS business_name
      FROM   bookings b
      LEFT JOIN services    s  ON b.service_id   = s.id
      LEFT JOIN businesses  bs ON b.business_id  = bs.id
      WHERE  b.reminded = 0
        AND  b.status   = 'confirmed'
        AND  b.datetime_iso >= ?
        AND  b.datetime_iso <= ?
    `).all(from, to);
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
      db.prepare('UPDATE bookings SET reminded = 1 WHERE id = ?').run(booking.id);
      console.log(`[reminders] Recordatorio enviado: booking #${booking.id} (${booking.client_name})`);
    } catch (err) {
      console.error(`[reminders] Fallo en booking #${booking.id}:`, err.message);
      // No marcamos reminded=1; se reintentará en la próxima ejecución
    }
  }

  if (bookings.length > 0) {
    console.log(`[reminders] Ciclo completado: ${bookings.length} recordatorio(s) procesado(s)`);
  }
}

function startReminderJob() {
  // Ejecutar inmediatamente al iniciar (útil para no perder citas tras un reinicio)
  sendReminders().catch(err => console.error('[reminders] Error inicial:', err.message));
  setInterval(() => {
    sendReminders().catch(err => console.error('[reminders] Error en ciclo:', err.message));
  }, INTERVAL_MS);
  console.log('[reminders] Job iniciado — revisa recordatorios cada 30 min');
}

module.exports = { startReminderJob };
