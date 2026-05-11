const router = require('express').Router();
const db = require('../db/database');

const DAYS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

// Perfil público de un negocio (para la página de reservas)
router.get('/:slug', (req, res) => {
  const business = db.prepare(
    'SELECT id, slug, name, phone, specialty, template_id, page_config FROM businesses WHERE slug = ?'
  ).get(req.params.slug);

  if (!business) return res.status(404).json({ error: 'Negocio no encontrado' });

  const services = db.prepare(
    'SELECT id, name, description, duration_min, price FROM services WHERE business_id = ? AND active = 1'
  ).all(business.id);

  const scheduleRows = db.prepare(
    'SELECT dow, slots FROM schedules WHERE business_id = ?'
  ).all(business.id);

  const schedules = scheduleRows.map(r => ({ dow: r.dow, slots: JSON.parse(r.slots) }));

  // Parse page_config if exists
  const pageConfig = business.page_config ? JSON.parse(business.page_config) : {};

  res.json({
    business: {
      id: business.id,
      slug: business.slug,
      name: business.name,
      phone: business.phone,
      specialty: business.specialty,
      template_id: business.template_id || 'modern_minimal',
      page_config: pageConfig
    },
    services,
    schedules
  });
});

// Slots disponibles (para el bot de WhatsApp y BookingPage)
router.get('/:slug/slots', (req, res) => {
  const business = db.prepare('SELECT id FROM businesses WHERE slug = ?').get(req.params.slug);
  if (!business) return res.status(404).json({ error: 'Negocio no encontrado' });

  const days = Math.min(30, Math.max(1, parseInt(req.query.days) || 7));
  const startDate = req.query.date ? new Date(req.query.date + 'T00:00:00') : new Date();
  startDate.setHours(0, 0, 0, 0);

  const scheduleRows = db.prepare('SELECT dow, slots FROM schedules WHERE business_id = ?').all(business.id);
  const scheduleMap = {};
  scheduleRows.forEach(r => { scheduleMap[r.dow] = JSON.parse(r.slots); });

  const result = [];

  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const dow = d.getDay();
    const allSlots = scheduleMap[dow] || [];
    if (!allSlots.length) continue;

    const dateStr = d.toISOString().slice(0, 10);

    const booked = db.prepare(`
      SELECT time(datetime_iso) as t FROM bookings
      WHERE business_id = ? AND date(datetime_iso) = ? AND status != 'cancelled'
    `).all(business.id, dateStr).map(r => r.t.slice(0, 5));

    const available = allSlots.filter(s => !booked.includes(s));
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

module.exports = router;
