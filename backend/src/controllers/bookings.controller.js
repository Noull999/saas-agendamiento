const pool = require('../db/database');
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

const list = async (req, res) => {
  const { date, status } = req.query;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
  const offset = (page - 1) * limit;

  try {
    let sql = 'WHERE b.business_id = $1';
    const params = [req.business.id];
    let paramCount = 1;

    if (date) {
      if (!DATE_RE.test(date)) return res.status(400).json({ error: 'formato de fecha inválido (YYYY-MM-DD)' });
      sql += ` AND DATE(b.datetime_iso AT TIME ZONE 'UTC') = $${++paramCount}`;
      params.push(date);
    }

    const { from } = req.query;
    if (from) {
      if (!DATE_RE.test(from)) return res.status(400).json({ error: 'formato de fecha inválido (YYYY-MM-DD)' });
      sql += ` AND DATE(b.datetime_iso AT TIME ZONE 'UTC') >= $${++paramCount}`;
      params.push(from);
    }

    if (status) {
      if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: `status debe ser uno de: ${VALID_STATUSES.join(', ')}` });
      sql += ` AND b.status = $${++paramCount}`;
      params.push(status);
    }

    const countResult = await pool.query(`SELECT COUNT(*) as n FROM bookings b ${sql}`, params);
    const total = parseInt(countResult.rows[0].n);

    params.push(limit, offset);
    const bookingsResult = await pool.query(`
      SELECT b.*, s.name as service_name, s.duration_min, p.name as patient_name, p.rut as patient_rut
      FROM bookings b
      LEFT JOIN services s ON b.service_id = s.id
      LEFT JOIN patients p ON b.patient_id = p.id
      ${sql}
      ORDER BY b.datetime_iso ASC
      LIMIT $${paramCount + 2} OFFSET $${paramCount + 3}
    `, params);

    res.json({ bookings: bookingsResult.rows, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('[bookings] List error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const create = async (req, res) => {
  const { client_name, client_email, client_phone, service_id, datetime_iso, notes, source } = req.body;

  if (!client_name || !datetime_iso) {
    return res.status(400).json({ error: 'client_name y datetime_iso son requeridos' });
  }

  try {
    if (service_id) {
      const service = await pool.query('SELECT id FROM services WHERE id = $1 AND business_id = $2', [service_id, req.business.id]);
      if (service.rows.length === 0) return res.status(404).json({ error: 'Servicio no encontrado' });
    }

    const conflict = await pool.query(
      "SELECT id FROM bookings WHERE business_id = $1 AND datetime_iso = $2 AND status != 'cancelled'",
      [req.business.id, datetime_iso]
    );
    if (conflict.rows.length > 0) return res.status(409).json({ error: 'Ese horario ya está reservado' });

    const insertResult = await pool.query(
      `INSERT INTO bookings (business_id, service_id, client_name, client_email, client_phone, datetime_iso, notes, source, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       RETURNING id`,
      [req.business.id, service_id || null, client_name, client_email || null, client_phone || null, datetime_iso, notes || null, source || 'web']
    );

    const bookingId = insertResult.rows[0].id;
    const booking = await pool.query(`
      SELECT b.*, s.name as service_name FROM bookings b
      LEFT JOIN services s ON b.service_id = s.id
      WHERE b.id = $1
    `, [bookingId]);

    res.status(201).json(booking.rows[0]);
  } catch (err) {
    console.error('[bookings] Create error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const updateStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const valid = ['confirmed', 'cancelled', 'completed', 'no_show'];

  if (!valid.includes(status)) {
    return res.status(400).json({ error: `status debe ser uno de: ${valid.join(', ')}` });
  }

  try {
    const booking = await pool.query('SELECT id FROM bookings WHERE id = $1 AND business_id = $2', [id, req.business.id]);
    if (booking.rows.length === 0) return res.status(404).json({ error: 'Reserva no encontrada' });

    const result = await pool.query('UPDATE bookings SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *', [status, id]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[bookings] UpdateStatus error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const remove = async (req, res) => {
  const { id } = req.params;

  try {
    const booking = await pool.query('SELECT id FROM bookings WHERE id = $1 AND business_id = $2', [id, req.business.id]);
    if (booking.rows.length === 0) return res.status(404).json({ error: 'Reserva no encontrada' });

    await pool.query('DELETE FROM bookings WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[bookings] Delete error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const publicCreate = async (req, res) => {
  const { slug } = req.params;

  try {
    const businessResult = await pool.query('SELECT * FROM businesses WHERE slug = $1', [slug]);
    if (businessResult.rows.length === 0) return res.status(404).json({ error: 'Negocio no encontrado' });
    const business = businessResult.rows[0];

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
      const service = await pool.query('SELECT id FROM services WHERE id = $1 AND business_id = $2', [serviceId, business.id]);
      if (service.rows.length === 0) return res.status(404).json({ error: 'Servicio no encontrado' });
    }

    const VALID_SOURCES = ['web', 'whatsapp', 'phone', 'other'];
    const source = VALID_SOURCES.includes(req.body.source) ? req.body.source : 'web';

    const cancelToken = randomUUID();
    const client = await pool.connect();
    let booking;

    try {
      await client.query('BEGIN');
      const conflict = await client.query(
        "SELECT id FROM bookings WHERE business_id = $1 AND datetime_iso = $2 AND status != 'cancelled'",
        [business.id, datetime_iso]
      );

      if (conflict.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Ese horario ya no está disponible' });
      }

      const insertResult = await client.query(`
        INSERT INTO bookings (business_id, service_id, client_name, client_email, client_phone, datetime_iso, notes, source, client_rut, cancel_token, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
        RETURNING id
      `, [business.id, serviceId || null, name, email, phone, datetime_iso, notes, source, rut, cancelToken]);

      const bookingId = insertResult.rows[0].id;
      const bookingFetch = await client.query('SELECT * FROM bookings WHERE id = $1', [bookingId]);
      booking = bookingFetch.rows[0];

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const serviceRow = serviceId
      ? (await pool.query('SELECT name FROM services WHERE id = $1', [serviceId])).rows[0]
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
  } catch (err) {
    console.error('[bookings] Error al crear reserva:', err.message);
    res.status(500).json({ error: 'Error interno al crear la reserva' });
  }
};

const updateBooking = async (req, res) => {
  try {
    const booking = await pool.query('SELECT id FROM bookings WHERE id = $1 AND business_id = $2', [req.params.id, req.business.id]);
    if (booking.rows.length === 0) return res.status(404).json({ error: 'Reserva no encontrada' });

    const { patient_id } = req.body;
    if (patient_id !== undefined) {
      let safePatientId = null;
      if (patient_id) {
        const owned = await pool.query('SELECT id FROM patients WHERE id = $1 AND business_id = $2', [patient_id, req.business.id]);
        if (owned.rows.length === 0) return res.status(404).json({ error: 'Paciente no encontrado' });
        safePatientId = owned.rows[0].id;
      }
      await pool.query('UPDATE bookings SET patient_id = $1, updated_at = NOW() WHERE id = $2', [safePatientId, req.params.id]);
    }

    const result = await pool.query('SELECT * FROM bookings WHERE id = $1', [req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[bookings] UpdateBooking error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { list, create, updateStatus, remove, publicCreate, updateBooking };
