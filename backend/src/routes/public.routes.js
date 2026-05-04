const router = require('express').Router();
const db = require('../db/database');

// Perfil público de un negocio (para la página de reservas)
router.get('/:slug', (req, res) => {
  const business = db.prepare(
    'SELECT id, slug, name, phone FROM businesses WHERE slug = ?'
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

module.exports = router;
