const router = require('express').Router();
const db = require('../db/database');

const DAYS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

// Perfil público de un negocio (para la página de reservas)
router.get('/:slug', (req, res) => {
  const business = db.prepare(
    'SELECT id, slug, name, phone, specialty, vertical FROM businesses WHERE slug = ?'
  ).get(req.params.slug);

  if (!business) return res.status(404).json({ error: 'Negocio no encontrado' });

  const services = db.prepare(
    'SELECT id, name, description, duration_min, price FROM services WHERE business_id = ? AND active = 1'
  ).all(business.id);

  const scheduleRows = db.prepare(
    'SELECT dow, slots FROM schedules WHERE business_id = ?'
  ).all(business.id);

  const schedules = scheduleRows.map(r => ({ dow: r.dow, slots: JSON.parse(r.slots) }));

  res.json({ business, services, schedules });
});

// Expande un rango {start, end} en slots individuales cada `step` minutos
function expandRange(start, end, stepMin = 30) {
  const slots = [];
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let cur = sh * 60 + sm;
  const endMins = eh * 60 + em;
  while (cur < endMins) {
    const h = Math.floor(cur / 60);
    const m = cur % 60;
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    cur += stepMin;
  }
  return slots;
}

// Slots disponibles (para el bot de WhatsApp y BookingPage)
router.get('/:slug/slots', (req, res) => {
  const business = db.prepare('SELECT id FROM businesses WHERE slug = ?').get(req.params.slug);
  if (!business) return res.status(404).json({ error: 'Negocio no encontrado' });

  const days = Math.min(30, Math.max(1, parseInt(req.query.days) || 7));
  const startDate = req.query.date ? new Date(req.query.date + 'T00:00:00') : new Date();
  startDate.setHours(0, 0, 0, 0);

  // Paso de slots: usar duración del servicio si se pasa, mínimo 30 min
  const serviceId = req.query.service_id ? parseInt(req.query.service_id) : null;
  let stepMin = 30;
  if (serviceId) {
    const svc = db.prepare('SELECT duration_min FROM services WHERE id = ? AND business_id = ?').get(serviceId, business.id);
    if (svc) stepMin = svc.duration_min;
  }

  const scheduleRows = db.prepare('SELECT dow, slots FROM schedules WHERE business_id = ?').all(business.id);
  const scheduleMap = {};
  scheduleRows.forEach(r => { scheduleMap[r.dow] = JSON.parse(r.slots); });

  const result = [];

  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const dow = d.getDay();
    const ranges = scheduleMap[dow] || [];
    if (!ranges.length) continue;

    const dateStr = d.toISOString().slice(0, 10);

    // Reservas ocupadas ese día (formato HH:MM)
    const booked = db.prepare(`
      SELECT time(datetime_iso) as t FROM bookings
      WHERE business_id = ? AND date(datetime_iso) = ? AND status != 'cancelled'
    `).all(business.id, dateStr).map(r => r.t.slice(0, 5));

    // Expandir rangos en slots individuales y filtrar ocupados
    const allTimes = ranges.flatMap(r => expandRange(r.start, r.end, stepMin));
    const available = allTimes.filter(t => !booked.includes(t));
    if (!available.length) continue;

    result.push({
      date: dateStr,
      dow,
      label: `${DAYS_ES[dow]} ${d.getDate()} de ${MONTHS_ES[d.getMonth()]}`,
      slots: available,
    });
  }

  res.json(result);
});

// GET /cancel/:token — preview info de la reserva antes de cancelar
router.get('/cancel/:token', (req, res) => {
  const booking = db.prepare('SELECT * FROM bookings WHERE cancel_token = ?').get(req.params.token);
  if (!booking) return res.status(404).json({ error: 'Reserva no encontrada o enlace inválido' });
  if (booking.status === 'cancelled') return res.status(409).json({ error: 'ya_cancelada' });
  if (new Date(booking.datetime_iso) <= new Date()) return res.status(409).json({ error: 'ya_pasada' });

  const service  = booking.service_id ? db.prepare('SELECT name FROM services WHERE id = ?').get(booking.service_id) : null;
  const business = db.prepare('SELECT name FROM businesses WHERE id = ?').get(booking.business_id);

  res.json({
    booking: {
      id:            booking.id,
      client_name:   booking.client_name,
      datetime_iso:  booking.datetime_iso,
      status:        booking.status,
      service_name:  service?.name  || null,
      business_name: business?.name || null,
    },
  });
});

// POST /cancel/:token — confirma la cancelación
router.post('/cancel/:token', (req, res) => {
  const booking = db.prepare('SELECT * FROM bookings WHERE cancel_token = ?').get(req.params.token);
  if (!booking) return res.status(404).json({ error: 'Reserva no encontrada o enlace inválido' });
  if (booking.status === 'cancelled') return res.status(409).json({ error: 'ya_cancelada' });
  if (new Date(booking.datetime_iso) <= new Date()) return res.status(409).json({ error: 'ya_pasada' });

  db.prepare("UPDATE bookings SET status = 'cancelled' WHERE cancel_token = ?").run(req.params.token);
  res.json({ ok: true });
});

// GET /:slug/mis-citas?phone=... — portal básico del paciente
router.get('/:slug/mis-citas', (req, res) => {
  const business = db.prepare('SELECT id, name FROM businesses WHERE slug = ?').get(req.params.slug);
  if (!business) return res.status(404).json({ error: 'Negocio no encontrado' });

  const phone = (req.query.phone || '').trim();
  if (phone.length < 6) return res.status(400).json({ error: 'Ingresa tu número de teléfono' });

  const today = new Date().toISOString().slice(0, 10);
  const bookings = db.prepare(`
    SELECT b.id, b.datetime_iso, b.status, b.cancel_token,
           s.name as service_name
    FROM bookings b
    LEFT JOIN services s ON b.service_id = s.id
    WHERE b.business_id = ? AND b.client_phone = ?
      AND date(b.datetime_iso) >= ?
      AND b.status != 'cancelled'
    ORDER BY b.datetime_iso ASC
    LIMIT 20
  `).all(business.id, phone, today);

  res.json({ business: { name: business.name }, bookings });
});

module.exports = router;
