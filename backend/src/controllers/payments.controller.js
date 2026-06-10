const { MercadoPagoConfig, Preference } = require('mercadopago');
const db = require('../db/database');
const { verifyMpSignature } = require('../lib/mpSignature');

// Build a MercadoPagoConfig from the given access token
function getMP(accessToken) {
  if (!accessToken) throw new Error('Mercado Pago no configurado');
  return new MercadoPagoConfig({ accessToken });
}

// Resolve the MP access token for the current business.
// Priority: token propio del negocio (los pagos de reservas le llegan a ÉL)
// → fallback al token de la plataforma (solo para dev / negocio propio).
// El token de la plataforma se usa para las suscripciones del SaaS en
// billing.controller, NUNCA debe cobrar las reservas de terceros.
async function resolveToken(businessId) {
  // business_settings table may not exist yet; guard with try/catch
  try {
    const { rows } = await db.query(
      "SELECT value FROM business_settings WHERE business_id = $1 AND key = 'mp_access_token' LIMIT 1",
      [businessId]
    );
    if (rows[0]?.value) return rows[0].value;
  } catch { /* tabla aún no existe */ }
  return process.env.MERCADO_PAGO_ACCESS_TOKEN || null;
}

// POST /api/payments/preference   (public — called from booking page without JWT)
const createPreference = async (req, res) => {
  const { booking_id, client_email, client_name } = req.body;

  if (!booking_id) {
    return res.status(400).json({ error: 'Se requiere booking_id' });
  }

  try {
    // Resolve business + service desde la reserva en la DB. NUNCA confiar en el
    // monto que envía el cliente: el precio se deriva del servicio en el servidor
    // para evitar manipulación (p.ej. pagar $1 por un servicio de $30.000).
    const { rows } = await db.query(
      `SELECT b.business_id, b.service_id, biz.slug,
              s.name AS service_name, s.price AS service_price
         FROM bookings b
         JOIN businesses biz ON biz.id = b.business_id
         LEFT JOIN services s ON s.id = b.service_id AND s.business_id = b.business_id
        WHERE b.id = $1`,
      [parseInt(booking_id, 10)]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Reserva no encontrada' });

    const businessId = rows[0].business_id;
    const bizSlug = rows[0].slug || '';
    const serviceName = rows[0].service_name || 'Reserva';
    const amount = Number(rows[0].service_price);

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Este servicio no tiene un precio configurado para pago online' });
    }

    const mpToken = await resolveToken(businessId);
    if (!mpToken) {
      return res.status(400).json({ error: 'Mercado Pago no configurado para este negocio' });
    }

    const mpClient = getMP(mpToken);
    const preference = new Preference(mpClient);

    const frontendBase = process.env.FRONTEND_URL || 'http://localhost:5173';
    const backendBase  = process.env.BACKEND_URL  || 'http://localhost:3001';

    const result = await preference.create({
      body: {
        items: [{
          title: serviceName,
          quantity: 1,
          unit_price: Number(amount),
          currency_id: 'CLP',
        }],
        payer: {
          email: client_email || undefined,
          name:  client_name  || undefined,
        },
        back_urls: {
          success: `${frontendBase}/book/${bizSlug}?payment=success`,
          failure: `${frontendBase}/book/${bizSlug}?payment=failure`,
          pending: `${frontendBase}/book/${bizSlug}?payment=pending`,
        },
        auto_return: 'approved',
        notification_url: `${backendBase}/api/payments/webhook`,
        external_reference: booking_id != null ? String(booking_id) : undefined,
      },
    });

    // Persist preference (create table on first use if migration hasn't run yet)
    await db.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id               BIGSERIAL PRIMARY KEY,
        business_id      BIGINT    NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        booking_id       BIGINT    REFERENCES bookings(id),
        mp_preference_id TEXT,
        mp_payment_id    TEXT,
        amount           NUMERIC   NOT NULL,
        currency         TEXT      NOT NULL DEFAULT 'CLP',
        status           TEXT      NOT NULL DEFAULT 'pending',
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await db.query(
      `INSERT INTO payments (business_id, booking_id, mp_preference_id, amount, currency)
       VALUES ($1, $2, $3, $4, 'CLP')`,
      [businessId, booking_id ? parseInt(booking_id, 10) : null, result.id, Number(amount)]
    );

    return res.json({ preference_id: result.id, init_point: result.init_point });
  } catch (err) {
    console.error('[payments] createPreference error:', err.message);
    return res.status(500).json({ error: 'Error creando preferencia de pago: ' + err.message });
  }
};

// POST /api/payments/webhook   (no auth — called by Mercado Pago)
const webhook = async (req, res) => {
  const { type, data } = req.body || {};

  if (type !== 'payment' || !data?.id) return res.json({ ok: true });

  // Verificar la firma del webhook antes de procesar
  if (!verifyMpSignature(req, data.id)) {
    console.warn('[payments] webhook con firma inválida, ignorado');
    return res.status(401).json({ error: 'Firma inválida' });
  }

  try {
    // MP only sends the payment id — fetch the payment to get status and
    // external_reference (our booking_id).
    const { Payment } = require('mercadopago');
    const token = process.env.MERCADO_PAGO_ACCESS_TOKEN || await (async () => {
      const { rows } = await db.query(
        "SELECT value FROM business_settings WHERE key = 'mp_access_token' LIMIT 1"
      );
      return rows[0]?.value || null;
    })();
    if (!token) return res.json({ ok: true });

    const payment = await new Payment(getMP(token)).get({ id: data.id });
    const bookingId = payment.external_reference ? parseInt(payment.external_reference, 10) : null;
    if (!bookingId) return res.json({ ok: true });

    await db.query(
      `UPDATE payments
          SET status = $1, mp_payment_id = $2
        WHERE booking_id = $3`,
      [payment.status || 'pending', String(data.id), bookingId]
    );
    return res.json({ ok: true });
  } catch (err) {
    console.error('[payments] webhook error:', err.message);
    return res.status(500).json({ error: 'Error procesando webhook' });
  }
};

// GET /api/payments/:paymentId   (auth required)
const getPaymentStatus = async (req, res) => {
  const { paymentId } = req.params;
  try {
    const { rows } = await db.query(
      'SELECT * FROM payments WHERE id = $1 AND business_id = $2',
      [paymentId, req.business.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Pago no encontrado' });
    return res.json(rows[0]);
  } catch (err) {
    console.error('[payments] getPaymentStatus error:', err.message);
    return res.status(500).json({ error: 'Error obteniendo estado del pago' });
  }
};

// GET /api/payments   (auth required) — list all payments for this business
const listPayments = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT p.*, b.client_name, b.datetime_iso
         FROM payments p
         LEFT JOIN bookings b ON b.id = p.booking_id
        WHERE p.business_id = $1
        ORDER BY p.created_at DESC
        LIMIT 100`,
      [req.business.id]
    );
    return res.json(rows);
  } catch (err) {
    console.error('[payments] listPayments error:', err.message);
    return res.status(500).json({ error: 'Error listando pagos' });
  }
};

// POST /api/payments/settings   (auth required) — save MP token for this business
const saveSettings = async (req, res) => {
  const { mp_access_token, mp_enabled } = req.body;

  try {
    // Ensure business_settings table exists (created lazily here if not already)
    await db.query(`
      CREATE TABLE IF NOT EXISTS business_settings (
        id          BIGSERIAL PRIMARY KEY,
        business_id BIGINT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        key         TEXT   NOT NULL,
        value       TEXT,
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(business_id, key)
      )
    `);

    // Upsert mp_access_token
    if (mp_access_token !== undefined) {
      await db.query(
        `INSERT INTO business_settings (business_id, key, value)
             VALUES ($1, 'mp_access_token', $2)
         ON CONFLICT (business_id, key)
         DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [req.business.id, mp_access_token || null]
      );
    }

    // Upsert mp_enabled flag
    if (mp_enabled !== undefined) {
      await db.query(
        `INSERT INTO business_settings (business_id, key, value)
             VALUES ($1, 'mp_enabled', $2)
         ON CONFLICT (business_id, key)
         DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [req.business.id, mp_enabled ? '1' : '0']
      );
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('[payments] saveSettings error:', err.message);
    return res.status(500).json({ error: 'Error guardando configuración de Mercado Pago' });
  }
};

// GET /api/payments/settings   (auth required) — fetch MP settings for this business
const getSettings = async (req, res) => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS business_settings (
        id          BIGSERIAL PRIMARY KEY,
        business_id BIGINT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        key         TEXT   NOT NULL,
        value       TEXT,
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(business_id, key)
      )
    `);

    const { rows } = await db.query(
      "SELECT key, value FROM business_settings WHERE business_id = $1 AND key IN ('mp_access_token', 'mp_enabled')",
      [req.business.id]
    );

    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });

    return res.json({
      mp_enabled: settings.mp_enabled === '1',
      // Never return the real token — only indicate whether it is set
      mp_token_configured: !!settings.mp_access_token,
    });
  } catch (err) {
    console.error('[payments] getSettings error:', err.message);
    return res.status(500).json({ error: 'Error obteniendo configuración de Mercado Pago' });
  }
};

module.exports = { createPreference, webhook, getPaymentStatus, listPayments, saveSettings, getSettings };
