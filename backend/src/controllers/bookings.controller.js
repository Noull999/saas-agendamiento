const db = require('../db/database');
const { notifyBooking } = require('../services/whatsapp');

const VALID_STATUSES = ['confirmed', 'cancelled', 'completed', 'no_show'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const list = (req, res) => {
  const { date, status } = req.query;
  let query = `
    SELECT b.*, s.name as service_name, s.duration_min, p.name as patient_name, p.rut as patient_rut
    FROM bookings b
    LEFT JOIN services s ON b.service_id = s.id
    LEFT JOIN patients p ON b.patient_id = p.id
    WHERE b.business_id = ?
  `;
  const params = [req.business.id];

  if (date) {
    if (!DATE_RE.test(date)) return res.status(400).json({ error: 'formato de fecha inválido (YYYY-MM-DD)' });
    query += ' AND date(b.datetime_iso) = ?';
    params.push(date);
  }
  if (status) {
    if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: `status debe ser uno de: ${VALID_STATUSES.join(', ')}` });
    query += ' AND b.status = ?';
    params.push(status);
  }

  query += ' ORDER BY b.datetime_iso ASC LIMIT 500';
  const bookings = db.prepare(query).all(...params);
  res.json(bookings);
};

const create = (req, res) => {
  const { client_name, client_email, client_phone, service_id, datetime_iso, notes, source } = req.body;

  if (!client_name || !datetime_iso) {
    return res.status(400).json({ error: 'client_name y datetime_iso son requeridos' });
  }

  // Verificar que el servicio pertenece al negocio si se provee
  if (service_id) {
    const service = db.prepare('SELECT id FROM services WHERE id = ? AND business_id = ?').get(service_id, req.business.id);
    if (!service) return res.status(404).json({ error: 'Servicio no encontrado' });
  }

  const result = db.prepare(`
    INSERT INTO bookings (business_id, service_id, client_name, client_email, client_phone, datetime_iso, notes, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.business.id,
    service_id || null,
    client_name,
    client_email || null,
    client_phone || null,
    datetime_iso,
    notes || null,
    source || 'web'
  );

  const booking = db.prepare(`
    SELECT b.*, s.name as service_name FROM bookings b
    LEFT JOIN services s ON b.service_id = s.id
    WHERE b.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(booking);
};

const updateStatus = (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const valid = ['confirmed', 'cancelled', 'completed', 'no_show'];

  if (!valid.includes(status)) {
    return res.status(400).json({ error: `status debe ser uno de: ${valid.join(', ')}` });
  }

  const booking = db.prepare('SELECT id FROM bookings WHERE id = ? AND business_id = ?').get(id, req.business.id);
  if (!booking) return res.status(404).json({ error: 'Reserva no encontrada' });

  db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run(status, id);
  res.json(db.prepare('SELECT * FROM bookings WHERE id = ?').get(id));
};

const remove = (req, res) => {
  const { id } = req.params;
  const booking = db.prepare('SELECT id FROM bookings WHERE id = ? AND business_id = ?').get(id, req.business.id);
  if (!booking) return res.status(404).json({ error: 'Reserva no encontrada' });

  db.prepare('DELETE FROM bookings WHERE id = ?').run(id);
  res.json({ ok: true });
};

// Endpoint público — no requiere auth del negocio, solo el slug
const publicCreate = (req, res) => {
  const { slug } = req.params;
  const business = db.prepare('SELECT * FROM businesses WHERE slug = ?').get(slug);
  if (!business) return res.status(404).json({ error: 'Negocio no encontrado' });

  const { client_name, client_email, client_phone, client_rut, service_id, datetime_iso, notes } = req.body;
  if (!client_name || !datetime_iso) {
    return res.status(400).json({ error: 'client_name y datetime_iso son requeridos' });
  }

  if (service_id) {
    const service = db.prepare('SELECT id FROM services WHERE id = ? AND business_id = ?').get(service_id, business.id);
    if (!service) return res.status(404).json({ error: 'Servicio no encontrado' });
  }

  const result = db.prepare(`
    INSERT INTO bookings (business_id, service_id, client_name, client_email, client_phone, datetime_iso, notes, source, client_rut)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'web', ?)
  `).run(business.id, service_id || null, client_name, client_email || null, client_phone || null, datetime_iso, notes || null, client_rut || null);

  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(result.lastInsertRowid);

  const serviceRow = service_id
    ? db.prepare('SELECT name FROM services WHERE id = ?').get(service_id)
    : null;

  notifyBooking({
    clientName: client_name,
    clientPhone: client_phone || null,
    clientEmail: client_email || null,
    serviceName: serviceRow?.name || null,
    datetimeISO: datetime_iso,
    businessName: business.name,
  }).catch(err => console.error('[whatsapp] Error enviando notificación:', err));

  res.status(201).json({ ok: true, booking_id: booking.id, datetime_iso: booking.datetime_iso });
};

const updateBooking = (req, res) => {
  const booking = db.prepare('SELECT id FROM bookings WHERE id = ? AND business_id = ?').get(req.params.id, req.business.id);
  if (!booking) return res.status(404).json({ error: 'Reserva no encontrada' });
  const { patient_id } = req.body;
  if (patient_id !== undefined) {
    db.prepare('UPDATE bookings SET patient_id = ? WHERE id = ?').run(patient_id || null, req.params.id);
  }
  res.json(db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id));
};

module.exports = { list, create, updateStatus, remove, publicCreate, updateBooking };
