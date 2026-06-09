const router = require('express').Router();
const db = require('../db/database');

const DAYS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

function safeParseSlots(raw) {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Perfil público de un negocio (para la página de reservas)
router.get('/:slug', async (req, res) => {
  try {
    const { rows: bizRows } = await db.query(
      'SELECT id, slug, name, phone, specialty, vertical FROM businesses WHERE slug = $1',
      [req.params.slug]
    );
    const business = bizRows[0];
    if (!business) return res.status(404).json({ error: 'Negocio no encontrado' });

    const { rows: services } = await db.query(
      'SELECT id, name, description, duration_min, price FROM services WHERE business_id = $1 AND active = 1',
      [business.id]
    );

    const { rows: scheduleRows } = await db.query(
      'SELECT dow, slots FROM schedules WHERE business_id = $1',
      [business.id]
    );

    const schedules = scheduleRows.map(r => ({ dow: r.dow, slots: safeParseSlots(r.slots) }));

    // Check if business has Mercado Pago enabled
    let mpEnabled = false;
    try {
      const { rows: mpRows } = await db.query(
        "SELECT value FROM business_settings WHERE business_id = $1 AND key = 'mp_enabled' LIMIT 1",
        [business.id]
      );
      mpEnabled = mpRows[0]?.value === '1';
    } catch { /* business_settings table may not exist yet */ }

    res.json({ business: { ...business, mp_enabled: mpEnabled }, services, schedules });
  } catch (err) {
    console.error('[public] profile error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

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

// Slots disponibles
router.get('/:slug/slots', async (req, res) => {
  try {
    const { rows: bizRows } = await db.query('SELECT id FROM businesses WHERE slug = $1', [req.params.slug]);
    const business = bizRows[0];
    if (!business) return res.status(404).json({ error: 'Negocio no encontrado' });

    const days = Math.min(30, Math.max(1, parseInt(req.query.days) || 7));
    const startDate = req.query.date ? new Date(req.query.date + 'T00:00:00') : new Date();
    startDate.setHours(0, 0, 0, 0);

    const serviceId = req.query.service_id ? parseInt(req.query.service_id) : null;
    let stepMin = 30;
    if (serviceId && Number.isInteger(serviceId)) {
      const { rows: svcRows } = await db.query(
        'SELECT duration_min FROM services WHERE id = $1 AND business_id = $2',
        [serviceId, business.id]
      );
      if (svcRows[0]) stepMin = svcRows[0].duration_min;
    }

    const { rows: scheduleRows } = await db.query(
      'SELECT dow, slots FROM schedules WHERE business_id = $1',
      [business.id]
    );
    const scheduleMap = {};
    scheduleRows.forEach(r => { scheduleMap[r.dow] = safeParseSlots(r.slots); });

    const result = [];

    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const dow = d.getDay();
      const ranges = scheduleMap[dow] || [];
      if (!ranges.length) continue;

      const dateStr = d.toISOString().slice(0, 10);

      const { rows: bookedRows } = await db.query(`
        SELECT SUBSTRING(datetime_iso FROM 12 FOR 5) as t FROM bookings
        WHERE business_id = $1 AND LEFT(datetime_iso, 10) = $2 AND status != 'cancelled'
      `, [business.id, dateStr]);
      const booked = bookedRows.map(r => r.t);

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
  } catch (err) {
    console.error('[public] slots error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /cancel/:token — preview de la reserva antes de cancelar
router.get('/cancel/:token', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM bookings WHERE cancel_token = $1', [req.params.token]);
    const booking = rows[0];
    if (!booking) return res.status(404).json({ error: 'Reserva no encontrada o enlace inválido' });
    if (booking.status === 'cancelled') return res.status(409).json({ error: 'ya_cancelada' });
    if (new Date(booking.datetime_iso) <= new Date()) return res.status(409).json({ error: 'ya_pasada' });

    const service = booking.service_id
      ? (await db.query('SELECT name FROM services WHERE id = $1', [booking.service_id])).rows[0]
      : null;
    const { rows: bizRows } = await db.query('SELECT name FROM businesses WHERE id = $1', [booking.business_id]);
    const business = bizRows[0];

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
  } catch (err) {
    console.error('[public] cancel get error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /cancel/:token — confirma la cancelación
router.post('/cancel/:token', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM bookings WHERE cancel_token = $1', [req.params.token]);
    const booking = rows[0];
    if (!booking) return res.status(404).json({ error: 'Reserva no encontrada o enlace inválido' });
    if (booking.status === 'cancelled') return res.status(409).json({ error: 'ya_cancelada' });
    if (new Date(booking.datetime_iso) <= new Date()) return res.status(409).json({ error: 'ya_pasada' });

    await db.query("UPDATE bookings SET status = 'cancelled' WHERE cancel_token = $1", [req.params.token]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[public] cancel post error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /:slug/mis-citas?phone=... — portal básico del paciente
router.get('/:slug/mis-citas', async (req, res) => {
  try {
    const { rows: bizRows } = await db.query('SELECT id, name FROM businesses WHERE slug = $1', [req.params.slug]);
    const business = bizRows[0];
    if (!business) return res.status(404).json({ error: 'Negocio no encontrado' });

    const phone = (req.query.phone || '').trim();
    if (phone.length < 6) return res.status(400).json({ error: 'Ingresa tu número de teléfono' });

    const today = new Date().toISOString().slice(0, 10);
    const { rows: bookings } = await db.query(`
      SELECT b.id, b.datetime_iso, b.status, b.cancel_token,
             s.name as service_name
      FROM bookings b
      LEFT JOIN services s ON b.service_id = s.id
      WHERE b.business_id = $1 AND b.client_phone = $2
        AND LEFT(b.datetime_iso, 10) >= $3
        AND b.status != 'cancelled'
      ORDER BY b.datetime_iso ASC
      LIMIT 20
    `, [business.id, phone, today]);

    res.json({ business: { name: business.name }, bookings });
  } catch (err) {
    console.error('[public] mis-citas error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
