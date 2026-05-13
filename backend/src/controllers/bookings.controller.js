const db = require('../db/database');
const { randomUUID } = require('node:crypto');
const { notifyBooking } = require('../services/whatsapp');
const { sendBookingConfirmation } = require('../services/email');

const VALID_STATUSES = ['confirmed', 'cancelled', 'completed', 'no_show'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clipString(v, max) {
  if (v == null) return null;
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

const list = (req, res) => {
  const { date, status } = req.query;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
  const offset = (page - 1) * limit;

  let where = 'WHERE b.business_id = ?';
  const params = [req.business.id];

  if (date) {
    if (!DATE_RE.test(date)) return res.status(400).json({ error: 'formato de fecha inválido (YYYY-MM-DD)' });
    where += ' AND date(b.datetime_iso) = ?';
    params.push(date);
  }

  const { from } = req.query;
  if (from) {
    if (!DATE_RE.test(from)) return res.status(400).json({ error: 'formato de fecha inválido (YYYY-MM-DD)' });
    where += ' AND date(b.datetime_iso) >= ?';
    params.push(from);
  }
  if (status) {
    if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: `status debe ser uno de: ${VALID_STATUSES.join(', ')}` });
    where += ' AND b.status = ?';
    params.push(status);
  }

  const total = db.prepare(`SELECT COUNT(*) as n FROM bookings b ${where}`).get(...params).n;

  const bookings = db.prepare(`
    SELECT b.*, s.name as service_name, s.duration_min, p.name as patient_name, p.rut as patient_rut
    FROM bookings b
    LEFT JOIN services s ON b.service_id = s.id
    LEFT JOIN patients p ON b.patient_id = p.id
    ${where}
    ORDER BY b.datetime_iso ASC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  res.json({ bookings, total, page, pages: Math.ceil(total / limit) });
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

  const conflict = db.prepare(
    "SELECT id FROM bookings WHERE business_id = ? AND datetime_iso = ? AND status != 'cancelled'"
  ).get(req.business.id, datetime_iso);
  if (conflict) return res.status(409).json({ error: 'Ese horario ya está reservado' });

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

  // Validación + recorte de campos públicos (anti-spam / anti-payload-grande)
  const name = clipString(req.body.client_name, 100);
  if (!name) return res.status(400).json({ error: 'client_name es requerido' });

  const datetime_iso = req.body.datetime_iso;
  if (!datetime_iso || typeof datetime_iso !== 'string' || !DATETIME_RE.test(datetime_iso)) {
    return res.status(400).json({ error: 'datetime_iso inválido' });
  }
  if (new Date(datetime_iso) <= new Date()) {
    return res.status(400).json({ error: 'No se puede reservar en una fecha pasada' });
  }

  const email = clipString(req.body.client_email, 254);
  if (email && !EMAIL_RE.test(email)) return res.status(400).json({ error: 'email inválido' });

  const phone = clipString(req.body.client_phone, 30);
  const rut = clipString(req.body.client_rut, 20);
  const notes = clipString(req.body.notes, 500);
  const serviceId = req.body.service_id;

  if (serviceId !== undefined && serviceId !== null && !Number.isInteger(serviceId)) {
    return res.status(400).json({ error: 'service_id inválido' });
  }

  if (serviceId) {
    const service = db.prepare('SELECT id FROM services WHERE id = ? AND business_id = ?').get(serviceId, business.id);
    if (!service) return res.status(404).json({ error: 'Servicio no encontrado' });
  }

  const VALID_SOURCES = ['web', 'whatsapp', 'phone', 'other'];
  const source = VALID_SOURCES.includes(req.body.source) ? req.body.source : 'web';

  const cancelToken = randomUUID();
  let booking;
  try {
    db.exec('BEGIN IMMEDIATE');
    const conflict = db.prepare(
      "SELECT id FROM bookings WHERE business_id = ? AND datetime_iso = ? AND status != 'cancelled'"
    ).get(business.id, datetime_iso);

    if (conflict) {
      db.exec('ROLLBACK');
      return res.status(409).json({ error: 'Ese horario ya no está disponible' });
    }

    const result = db.prepare(`
      INSERT INTO bookings (business_id, service_id, client_name, client_email, client_phone, datetime_iso, notes, source, client_rut, cancel_token)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(business.id, serviceId || null, name, email, phone, datetime_iso, notes, source, rut, cancelToken);

    booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(result.lastInsertRowid);
    db.exec('COMMIT');
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch (_) {}
    console.error('[bookings] Error al crear reserva:', err.message);
    return res.status(500).json({ error: 'Error interno al crear la reserva' });
  }

  const serviceRow = serviceId
    ? db.prepare('SELECT name FROM services WHERE id = ?').get(serviceId)
    : null;

  notifyBooking({
    clientName: name,
    clientPhone: phone,
    clientEmail: email,
    serviceName: serviceRow?.name || null,
    datetimeISO: datetime_iso,
    businessName: business.name,
  }).catch(err => console.error('[whatsapp] Error enviando notificación:', err));

  sendBookingConfirmation({
    clientName: name,
    clientEmail: email,
    serviceName: serviceRow?.name || null,
    datetimeISO: datetime_iso,
    businessName: business.name,
    cancelToken,
  }).catch(err => console.error('[email] Error enviando confirmación:', err));

  res.status(201).json({ ok: true, booking_id: booking.id, datetime_iso: booking.datetime_iso, cancel_token: cancelToken });
};

const updateBooking = (req, res) => {
  const booking = db.prepare('SELECT id FROM bookings WHERE id = ? AND business_id = ?').get(req.params.id, req.business.id);
  if (!booking) return res.status(404).json({ error: 'Reserva no encontrada' });
  const { patient_id } = req.body;
  if (patient_id !== undefined) {
    let safePatientId = null;
    if (patient_id) {
      // Verifica que el paciente pertenece a este negocio (evita link cross-tenant)
      const owned = db.prepare('SELECT id FROM patients WHERE id = ? AND business_id = ?').get(patient_id, req.business.id);
      if (!owned) return res.status(404).json({ error: 'Paciente no encontrado' });
      safePatientId = owned.id;
    }
    db.prepare('UPDATE bookings SET patient_id = ? WHERE id = ?').run(safePatientId, req.params.id);
  }
  res.json(db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id));
};

module.exports = { list, create, updateStatus, remove, publicCreate, updateBooking };
