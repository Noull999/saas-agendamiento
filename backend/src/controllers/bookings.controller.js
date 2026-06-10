const db = require('../db/database');
const { randomUUID } = require('node:crypto');
const { notifyBookingConfirmation } = require('../services/notifications');
const { sendBookingConfirmation, sendBusinessNotification } = require('../services/email');
const { createCalendarEvent, deleteCalendarEvent } = require('../services/googleCalendar');

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

function parseDatetimeSafe(iso) {
  // If already has explicit TZ (Z, +, or - after the time), parse directly
  if (/T.*[Z+\-]/.test(iso)) return new Date(iso);
  // No TZ: assume Chile Standard Time (UTC-4)
  return new Date(iso + '-04:00');
}

const list = async (req, res) => {
  const { date, status, from, search } = req.query;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
  const offset = (page - 1) * limit;

  let where = 'WHERE b.business_id = $1';
  const params = [req.business.id];
  let i = 2;

  if (date) {
    if (!DATE_RE.test(date)) return res.status(400).json({ error: 'formato de fecha inválido (YYYY-MM-DD)' });
    where += ` AND LEFT(b.datetime_iso, 10) = $${i++}`;
    params.push(date);
  }
  if (from) {
    if (!DATE_RE.test(from)) return res.status(400).json({ error: 'formato de fecha inválido (YYYY-MM-DD)' });
    where += ` AND LEFT(b.datetime_iso, 10) >= $${i++}`;
    params.push(from);
  }
  if (status) {
    if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: `status debe ser uno de: ${VALID_STATUSES.join(', ')}` });
    where += ` AND b.status = $${i++}`;
    params.push(status);
  }
  if (search && search.trim()) {
    const s = `%${search.trim()}%`;
    const n1 = i++, n2 = i++, n3 = i++;
    where += ` AND (b.client_name ILIKE $${n1} OR b.client_phone ILIKE $${n2} OR s.name ILIKE $${n3})`;
    params.push(s, s, s);
  }
  if (req.query.location_id) {
    where += ` AND b.location_id = $${i++}`;
    params.push(req.query.location_id);
  }

  try {
    const { rows: totalRows } = await db.query(`SELECT COUNT(*) as n FROM bookings b LEFT JOIN services s ON b.service_id = s.id ${where}`, params);
    const total = parseInt(totalRows[0].n);

    const { rows: bookings } = await db.query(`
      SELECT b.*, s.name as service_name, s.duration_min, p.name as patient_name, p.rut as patient_rut
      FROM bookings b
      LEFT JOIN services s ON b.service_id = s.id
      LEFT JOIN patients p ON b.patient_id = p.id
      ${where}
      ORDER BY b.datetime_iso ASC
      LIMIT $${i++} OFFSET $${i++}
    `, [...params, limit, offset]);

    res.json({ bookings, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('[bookings] list error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const create = async (req, res) => {
  const { client_name, client_email, client_phone, service_id, datetime_iso, notes, source } = req.body;

  if (!client_name || !datetime_iso) {
    return res.status(400).json({ error: 'client_name y datetime_iso son requeridos' });
  }

  const client = await db.connect();
  try {
    if (service_id) {
      const { rows } = await client.query('SELECT id FROM services WHERE id = $1 AND business_id = $2', [service_id, req.business.id]);
      if (!rows[0]) return res.status(404).json({ error: 'Servicio no encontrado' });
    }

    await client.query('BEGIN');

    // Enforce plan limits
    const { rows: planRows } = await client.query(
      'SELECT plan FROM businesses WHERE id = $1', [req.business.id]
    );
    const plan = planRows[0]?.plan || 'basic';
    if (plan === 'basic') {
      const monthStart = new Date();
      monthStart.setDate(1); monthStart.setHours(0,0,0,0);
      const monthStr = monthStart.toISOString().slice(0, 10);
      const { rows: countRows } = await client.query(
        "SELECT COUNT(*) as n FROM bookings WHERE business_id = $1 AND LEFT(datetime_iso, 10) >= $2 AND status NOT IN ('cancelled')",
        [req.business.id, monthStr]
      );
      if (parseInt(countRows[0].n) >= 100) {
        await client.query('ROLLBACK');
        return res.status(403).json({
          error: 'Has alcanzado el límite de 100 reservas mensuales del plan Basic. Actualiza a Pro para reservas ilimitadas.',
          requiredPlan: 'pro',
          currentPlan: 'basic',
        });
      }
    }

    const { rows: conflict } = await client.query(
      "SELECT id FROM bookings WHERE business_id = $1 AND datetime_iso = $2 AND status != 'cancelled'",
      [req.business.id, datetime_iso]
    );
    if (conflict.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Ese horario ya está reservado' });
    }

    const { rows } = await client.query(`
      INSERT INTO bookings (business_id, service_id, client_name, client_email, client_phone, datetime_iso, notes, source)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [req.business.id, service_id || null, client_name, client_email || null, client_phone || null, datetime_iso, notes || null, source || 'web']);

    await client.query('COMMIT');

    const { rows: full } = await db.query(`
      SELECT b.*, s.name as service_name FROM bookings b
      LEFT JOIN services s ON b.service_id = s.id
      WHERE b.id = $1
    `, [rows[0].id]);

    // Non-blocking: notify business owner by email
    (async () => {
      try {
        const { rows: biz } = await db.query(
          'SELECT owner_email, name FROM businesses WHERE id = $1', [req.business.id]
        );
        if (biz[0]?.owner_email) {
          await sendBusinessNotification({
            businessEmail: biz[0].owner_email,
            businessName: biz[0].name,
            clientName: full[0].client_name,
            clientPhone: full[0].client_phone,
            serviceName: full[0].service_name,
            datetimeISO: full[0].datetime_iso,
          });
        }
      } catch (e) {
        console.error('[bookings] Failed to notify business by email:', e.message);
      }
    })();

    res.status(201).json(full[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[bookings] create error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    client.release();
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
    const { rows } = await db.query('SELECT id, gcal_event_id FROM bookings WHERE id = $1 AND business_id = $2', [id, req.business.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Reserva no encontrada' });

    await db.query('UPDATE bookings SET status = $1 WHERE id = $2', [status, id]);
    const { rows: updated } = await db.query('SELECT * FROM bookings WHERE id = $1', [id]);

    // Si se cancela la reserva, borrar el evento del Google Calendar (no bloqueante)
    if (status === 'cancelled' && rows[0].gcal_event_id) {
      deleteCalendarEvent(req.business.id, rows[0].gcal_event_id)
        .then((ok) => {
          if (ok) db.query('UPDATE bookings SET gcal_event_id = NULL WHERE id = $1', [id]).catch(() => {});
        })
        .catch(err => console.warn('[bookings] Google Calendar delete error:', err.message));
    }

    res.json(updated[0]);
  } catch (err) {
    console.error('[bookings] updateStatus error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const remove = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await db.query('SELECT id, gcal_event_id FROM bookings WHERE id = $1 AND business_id = $2', [id, req.business.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Reserva no encontrada' });

    if (rows[0].gcal_event_id) {
      deleteCalendarEvent(req.business.id, rows[0].gcal_event_id)
        .catch(err => console.warn('[bookings] Google Calendar delete error:', err.message));
    }

    await db.query('DELETE FROM bookings WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[bookings] remove error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const publicCreate = async (req, res) => {
  const { slug } = req.params;

  const name = clipString(req.body.client_name, 100);
  if (!name) return res.status(400).json({ error: 'client_name es requerido' });

  const datetime_iso = req.body.datetime_iso;
  if (!datetime_iso || typeof datetime_iso !== 'string' || !DATETIME_RE.test(datetime_iso)) {
    return res.status(400).json({ error: 'datetime_iso inválido' });
  }
  const bookingDate = parseDatetimeSafe(datetime_iso);
  if (isNaN(bookingDate.getTime())) {
    return res.status(400).json({ error: 'datetime_iso inválido' });
  }
  if (bookingDate <= new Date()) {
    return res.status(400).json({ error: 'No se puede reservar en una fecha pasada' });
  }

  const email = clipString(req.body.client_email, 254);
  if (email && !EMAIL_RE.test(email)) return res.status(400).json({ error: 'email inválido' });

  const phone = clipString(req.body.client_phone, 30);
  const rut = clipString(req.body.client_rut, 20);
  const notes = clipString(req.body.notes, 500);
  // service_id may arrive as string ("5") from JSON when IDs are BIGSERIAL
  const rawServiceId = req.body.service_id;
  const serviceId = rawServiceId != null ? parseInt(rawServiceId, 10) : null;
  if (serviceId !== null && (isNaN(serviceId) || serviceId <= 0)) {
    return res.status(400).json({ error: 'service_id inválido' });
  }

  const VALID_SOURCES = ['web', 'whatsapp', 'phone', 'other'];
  const source = VALID_SOURCES.includes(req.body.source) ? req.body.source : 'web';

  const client = await db.connect();
  try {
    // Resolve slug: try business slug first, then location slug_suffix
    let business = null;
    let locationId = null;

    const { rows: bizRows } = await client.query('SELECT * FROM businesses WHERE slug = $1', [slug]);
    if (bizRows[0]) {
      business = bizRows[0];
    } else {
      const { rows: locRows } = await client.query(
        `SELECT b.*, l.id AS location_id
           FROM locations l
           JOIN businesses b ON l.business_id = b.id
          WHERE l.slug_suffix = $1 AND l.active = true`,
        [slug]
      );
      if (!locRows[0]) return res.status(404).json({ error: 'Negocio no encontrado' });
      locationId = locRows[0].location_id;
      // Strip the synthetic location_id column from the business object
      const { location_id: _loc, ...biz } = locRows[0];
      business = biz;
    }

    if (serviceId) {
      const { rows: svcRows } = await client.query('SELECT id FROM services WHERE id = $1 AND business_id = $2', [serviceId, business.id]);
      if (!svcRows[0]) return res.status(404).json({ error: 'Servicio no encontrado' });
    }

    const cancelToken = randomUUID();

    await client.query('BEGIN');

    const { rows: conflict } = await client.query(
      "SELECT id FROM bookings WHERE business_id = $1 AND datetime_iso = $2 AND status != 'cancelled'",
      [business.id, datetime_iso]
    );
    if (conflict.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Ese horario ya no está disponible' });
    }

    // Consentimiento de tratamiento de datos: si el cliente lo aceptó en el
    // formulario público, se guarda la marca de tiempo como evidencia.
    const consentAt = req.body.consent === true ? new Date() : null;

    const { rows } = await client.query(`
      INSERT INTO bookings (business_id, location_id, service_id, client_name, client_email, client_phone, datetime_iso, notes, source, client_rut, cancel_token, data_consent_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [business.id, locationId, serviceId || null, name, email, phone, datetime_iso, notes, source, rut, cancelToken, consentAt]);

    await client.query('COMMIT');
    const booking = rows[0];

    const serviceRow = serviceId
      ? (await db.query('SELECT name, duration_min FROM services WHERE id = $1', [serviceId])).rows[0]
      : null;

    notifyBookingConfirmation({
      clientName: name, clientPhone: phone, clientEmail: email,
      serviceName: serviceRow?.name || null, datetimeISO: datetime_iso,
      businessName: business.name, businessId: business.id, cancelToken,
    }).catch(err => console.error('[notifications] Error enviando notificación:', err));

    sendBookingConfirmation({
      clientName: name, clientEmail: email,
      serviceName: serviceRow?.name || null, datetimeISO: datetime_iso,
      businessName: business.name, cancelToken, businessId: business.id,
    }).catch(err => console.error('[email] Error enviando confirmación:', err));

    // Sincronizar con Google Calendar si el negocio lo tiene conectado (no bloqueante)
    (async () => {
      try {
        const startDate = parseDatetimeSafe(datetime_iso);
        const durationMin = serviceRow?.duration_min || 60;
        const endISO = new Date(startDate.getTime() + durationMin * 60000).toISOString();
        const eventId = await createCalendarEvent(business.id, {
          summary: `${name}${serviceRow?.name ? ' — ' + serviceRow.name : ''}`,
          description: `Reserva de ${name}${phone ? '\nTel: ' + phone : ''}${email ? '\nEmail: ' + email : ''}`,
          startISO: startDate.toISOString(),
          endISO,
        });
        if (eventId) {
          await db.query('UPDATE bookings SET gcal_event_id = $1 WHERE id = $2', [eventId, booking.id]);
        }
      } catch (err) {
        console.warn('[bookings] Google Calendar sync error:', err.message);
      }
    })();

    res.status(201).json({ ok: true, booking_id: booking.id, datetime_iso: booking.datetime_iso, cancel_token: cancelToken });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[bookings] publicCreate error:', err.message);
    res.status(500).json({ error: 'Error interno al crear la reserva' });
  } finally {
    client.release();
  }
};

const updateBooking = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT id FROM bookings WHERE id = $1 AND business_id = $2', [req.params.id, req.business.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Reserva no encontrada' });

    const { patient_id } = req.body;
    if (patient_id !== undefined) {
      let safePatientId = null;
      if (patient_id) {
        const { rows: owned } = await db.query('SELECT id FROM patients WHERE id = $1 AND business_id = $2', [patient_id, req.business.id]);
        if (!owned[0]) return res.status(404).json({ error: 'Paciente no encontrado' });
        safePatientId = owned[0].id;
      }
      await db.query('UPDATE bookings SET patient_id = $1 WHERE id = $2', [safePatientId, req.params.id]);
    }

    const { rows: updated } = await db.query('SELECT * FROM bookings WHERE id = $1', [req.params.id]);
    res.json(updated[0]);
  } catch (err) {
    console.error('[bookings] updateBooking error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const rescheduleBooking = async (req, res) => {
  const { id } = req.params;
  const { datetime_iso } = req.body;

  if (!datetime_iso) {
    return res.status(400).json({ error: 'datetime_iso requerido' });
  }
  if (!DATETIME_RE.test(datetime_iso)) {
    return res.status(400).json({ error: 'datetime_iso inválido' });
  }

  try {
    const bookingDate = parseDatetimeSafe(datetime_iso);
    if (isNaN(bookingDate.getTime())) {
      return res.status(400).json({ error: 'datetime_iso inválido' });
    }
    if (bookingDate <= new Date()) {
      return res.status(400).json({ error: 'No se puede reservar en una fecha pasada' });
    }

    // Verify booking belongs to this business
    const { rows: existing } = await db.query(
      'SELECT id, service_id FROM bookings WHERE id = $1 AND business_id = $2',
      [id, req.business.id]
    );
    if (!existing[0]) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    // Check for double-booking at new datetime (excluding this booking)
    const { rows: conflict } = await db.query(
      `SELECT id FROM bookings
       WHERE business_id = $1
         AND datetime_iso = $2
         AND id != $3
         AND status != 'cancelled'`,
      [req.business.id, datetime_iso, id]
    );
    if (conflict.length > 0) {
      return res.status(409).json({ error: 'Ese slot ya está reservado' });
    }

    const { rows } = await db.query(
      `UPDATE bookings
       SET datetime_iso = $1, reminded = 0
       WHERE id = $2 AND business_id = $3
       RETURNING *`,
      [datetime_iso, id, req.business.id]
    );

    res.json({ ok: true, booking: rows[0] });
  } catch (err) {
    console.error('[bookings] rescheduleBooking error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { list, create, updateStatus, remove, publicCreate, updateBooking, rescheduleBooking };
