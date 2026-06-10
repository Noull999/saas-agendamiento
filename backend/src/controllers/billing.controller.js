const db = require('../db/database');

// ── Suscripciones vía Mercado Pago (preapproval) ─────────────────────────────
// El cobro mensual del SaaS llega a la cuenta MP de la plataforma
// (MERCADO_PAGO_ACCESS_TOKEN en el entorno), no a la de cada negocio.

const PLAN_PRICES = {
  basic:    9990,
  pro:      19990,
  business: 34990,
};

function getPlatformToken() {
  const token = process.env.MP_PLATFORM_ACCESS_TOKEN || process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!token) throw new Error('Token de Mercado Pago de la plataforma no configurado');
  return token;
}

async function mpFetch(path, options = {}) {
  const res = await fetch(`https://api.mercadopago.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getPlatformToken()}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.message || `MP API ${res.status}`);
  }
  return body;
}

// Activa el plan de un negocio a partir de un preapproval autorizado.
// Valida monto y external_reference para evitar manipulación.
async function activateFromPreapproval(preapproval, expectedBusinessId = null) {
  const [bizIdRaw, plan] = String(preapproval.external_reference || '').split(':');
  const businessId = parseInt(bizIdRaw, 10);

  if (!businessId || !PLAN_PRICES[plan]) {
    throw new Error(`external_reference inválido: ${preapproval.external_reference}`);
  }
  if (expectedBusinessId && businessId !== Number(expectedBusinessId)) {
    throw new Error('La suscripción no corresponde a este negocio');
  }
  const amount = Number(preapproval.auto_recurring?.transaction_amount);
  if (amount !== PLAN_PRICES[plan]) {
    throw new Error(`Monto no coincide con el plan ${plan}`);
  }
  if (preapproval.status !== 'authorized') {
    throw new Error(`Suscripción no autorizada (estado: ${preapproval.status})`);
  }

  await db.query(
    `UPDATE businesses
        SET plan = $1, subscription_status = 'active', mp_preapproval_id = $2
      WHERE id = $3`,
    [plan, preapproval.id, businessId]
  );
  console.log(`[billing] Suscripción MP activada: business #${businessId} → plan ${plan}`);
  return { businessId, plan };
}

// POST /api/billing/checkout   { plan: 'basic' | 'pro' | 'business' }
const createCheckout = async (req, res) => {
  const { plan } = req.body;
  const price = PLAN_PRICES[plan];

  if (!price) {
    return res.status(400).json({ error: 'Plan inválido. Valores aceptados: basic, pro, business' });
  }

  try {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    const preapproval = await mpFetch('/preapproval', {
      method: 'POST',
      body: JSON.stringify({
        reason: `AgendaSaaS — Plan ${plan.charAt(0).toUpperCase() + plan.slice(1)}`,
        external_reference: `${req.business.id}:${plan}`,
        payer_email: req.business.email,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: price,
          currency_id: 'CLP',
        },
        back_url: `${frontendUrl}/dashboard/configuracion`,
        status: 'pending',
      }),
    });

    res.json({ url: preapproval.init_point });
  } catch (err) {
    console.error('[billing] Error al crear suscripción MP:', err.message);
    res.status(500).json({ error: 'No se pudo iniciar la suscripción. Intenta de nuevo.' });
  }
};

// POST /api/billing/confirm   { preapproval_id }
// El usuario vuelve de MP con ?preapproval_id=... en la URL; el frontend lo
// envía aquí para verificar contra la API de MP y activar el plan.
const confirmSubscription = async (req, res) => {
  const { preapproval_id } = req.body;
  if (!preapproval_id) {
    return res.status(400).json({ error: 'preapproval_id requerido' });
  }

  try {
    const preapproval = await mpFetch(`/preapproval/${encodeURIComponent(preapproval_id)}`);
    const { plan } = await activateFromPreapproval(preapproval, req.business.id);
    res.json({ ok: true, plan });
  } catch (err) {
    console.error('[billing] Error confirmando suscripción:', err.message);
    res.status(400).json({ error: 'No se pudo confirmar la suscripción: ' + err.message });
  }
};

// POST /api/billing/webhook   (sin auth — Mercado Pago server-to-server)
const webhook = async (req, res) => {
  const { type, data } = req.body || {};

  if (type !== 'subscription_preapproval' || !data?.id) {
    return res.json({ ok: true });
  }

  try {
    const preapproval = await mpFetch(`/preapproval/${encodeURIComponent(data.id)}`);

    if (preapproval.status === 'authorized') {
      await activateFromPreapproval(preapproval);
    } else if (['cancelled', 'paused'].includes(preapproval.status)) {
      await db.query(
        `UPDATE businesses SET subscription_status = 'cancelled' WHERE mp_preapproval_id = $1`,
        [preapproval.id]
      );
      console.log(`[billing] Suscripción ${preapproval.id} → ${preapproval.status}`);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[billing] Error procesando webhook MP:', err.message);
    res.status(500).json({ error: 'Error procesando webhook' });
  }
};

// GET /api/billing/plans
const getPlans = (_req, res) => {
  res.json({
    trialDays: 14,
    plans: [
      {
        id:       'basic',
        name:     'Basic',
        price:    PLAN_PRICES.basic,
        currency: 'CLP',
        features: [
          'Agenda estándar para cualquier negocio',
          '1 profesional',
          'Hasta 100 reservas/mes',
          'Página de reservas pública',
          'Soporte por email',
        ],
      },
      {
        id:       'pro',
        name:     'Pro',
        price:    PLAN_PRICES.pro,
        currency: 'CLP',
        highlight: true,
        features: [
          'Todo lo de Basic',
          'Recordatorios WhatsApp automáticos',
          'Historial de clientes y pacientes',
          'Consultas y fichas clínicas',
          'Hasta 5 profesionales',
          'Analytics de ingresos',
          'Soporte prioritario',
        ],
      },
      {
        id:       'business',
        name:     'Business',
        price:    PLAN_PRICES.business,
        currency: 'CLP',
        features: [
          'Todo lo de Pro',
          'Bot IA para reservar por WhatsApp',
          'Profesionales ilimitados',
          'Múltiples sedes',
          'Onboarding personalizado',
        ],
      },
    ],
  });
};

module.exports = { createCheckout, confirmSubscription, webhook, getPlans };
