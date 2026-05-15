/**
 * Job de recordatorios WhatsApp
 * Corre cada 30 minutos y envía un mensaje a clientes con citas en las próximas 23-25 horas.
 * La ventana de 2h (±1h alrededor de las 24h) evita duplicados aunque el job se desfase.
 */

const pool = require('../db/database');
const { notifyReminder } = require('../services/whatsapp');

const INTERVAL_MS = 30 * 60 * 1000; // cada 30 minutos

async function sendReminders() {
  const now  = Date.now();
  const from = new Date(now + 23 * 60 * 60 * 1000).toISOString(); // 23h desde ahora
  const to   = new Date(now + 25 * 60 * 60 * 1000).toISOString(); // 25h desde ahora

  let bookings;
  try {
    const result = await pool.query(`
      SELECT b.id, b.patient_rut, b.booking_date, b.booking_time,
             s.name AS service_name, bs.email AS business_email
      FROM bookings b
      LEFT JOIN services s ON b.service_id = s.id
      LEFT JOIN businesses bs ON b.business_id = bs.id
      WHERE b.reminder_sent = false
        AND b.status = 'confirmed'
        AND CONCAT(b.booking_date, 'T', b.booking_time) >= $1
        AND CONCAT(b.booking_date, 'T', b.booking_time) <= $2
    `, [from, to]);
    bookings = result.rows;
  } catch (err) {
    console.error('[reminders] Error al consultar bookings:', err.message);
    return;
  }

  for (const booking of bookings) {
    try {
      await notifyReminder({
        patientRut: booking.patient_rut,
        serviceName: booking.service_name,
        bookingDate: booking.booking_date,
        bookingTime: booking.booking_time,
        businessEmail: booking.business_email,
      });
      await pool.query('UPDATE bookings SET reminder_sent = true WHERE id = $1', [booking.id]);
      console.log(`[reminders] Recordatorio enviado: booking #${booking.id}`);
    } catch (err) {
      console.error(`[reminders] Fallo en booking #${booking.id}:`, err.message);
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
