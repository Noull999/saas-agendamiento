const { MercadoPagoConfig, Preference } = require('mercadopago');
const db = require('../db/database');

// Build a MercadoPagoConfig from the given access token
function getMP(accessToken) {
  if (!accessToken) throw new Error('Mercado Pago no configurado');
  return new MercadoPagoConfig({ accessToken });
}

// Resolve the MP access token for the current business.
// Priority: env var (shared) → business-level setting in business_settings table.
async function resolveToken(businessId) {
  if (process.env.MERCADO_PAGO_ACCESS_TOKEN) {
    return process.env.MERCADO_PAGO_ACCESS_TOKEN;
  }
  // business_settings table may not exist yet; guard with try/catch
  try {
    const { rows } = await db.query(
      "SELECT value FROM business_settings WHERE business_id = $1 AND key = 'mp_access_token' LIMIT 1",
      [businessId]
    );
    return rows[0]?.value || null;
  } catch {
    return null;
  }
}

// POST /api/payments/preference   (public — called from booking page without JWT)
const createPreference = async (req, res) => {
  const { booking_id, service_id, amount, client_email, client_name } = req.body;

  if (!amount || Number(amount) <= 0) {
    return res.status(400).json({ error: 'Monto inválido' });
  }

  try {
    // Resolve business_id: from JWT (dashboard) or from booking_id (public page)
    let businessId = req.business?.id || null;
    let bizSlug = null;

    if (!businessId && booking_id) {
      const { rows } = await db.query(
        'SELECT b.business_id, biz.slug FROM bookings b JOIN businesses biz ON biz.id = b.business_id WHERE b.id = $1',
        [booking_id]
      );
      if (!rows[0]) return res.status(404).json({ error: 'Reserva no encontrada' });
      businessId = rows[0].business_id;
      bizSlug = rows[0].slug;
    }

    if (!businessId) {
      return res.status(400).json({ error: 'Se requiere booking_id' });
    }

    const mpToken = await resolveToken(businessId);
    if (!mpToken) {
      return res.status(400).json({ error: 'Mercado Pago no configurado para este negocio' });
    }

    const mpClient = getMP(mpToken);
    const preference = new Preference(mpClient);

    // Fetch service name
    let serviceName = 'Consulta';
    const parsedServiceId = service_id != null ? parseInt(service_id, 10) : null;
    if (parsedServiceId) {
      const { rows: svc } = await db.query(
        'SELECT name FROM services WHERE id = $1 AND business_id = $2',
        [parsedServiceId, businessId]
      );
      if (svc[0]) serviceName = svc[0].name;
    }

    // Fetch slug if not already resolved
    if (!bizSlug) {
      const { rows: biz } = await db.query('SELECT slug FROM businesses WHERE id = $1', [businessId]);
      bizSlug = biz[0]?.slug || '';
    }

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

  if (type !== 'payment') return res.json({ ok: true });

  try {
    // NOTE: In production you should verify the X-Signature header with
    // MERCADO_PAGO_WEBHOOK_SECRET before trusting this payload.
    await db.query(
      `UPDATE payments
          SET status = 'approved', mp_payment_id = $1
        WHERE mp_preference_id = $2`,
      [String(data?.id || ''), String(data?.preference_id || '')]
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
