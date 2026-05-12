const db = require('../db/database');

// Stripe se inicializa solo si la clave está configurada
function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY no configurada');
  }
  return require('stripe')(process.env.STRIPE_SECRET_KEY);
}

const PLAN_PRICE_IDS = {
  pro:     process.env.STRIPE_PRICE_PRO,
  clinica: process.env.STRIPE_PRICE_CLINICA,
};

// POST /api/billing/checkout
// Body: { plan: 'pro' | 'clinica' }
const createCheckout = async (req, res) => {
  try {
    const stripe = getStripe();
    const { plan } = req.body;
    const priceId  = PLAN_PRICE_IDS[plan];

    if (!priceId) {
      return res.status(400).json({ error: 'Plan inválido. Valores aceptados: pro, clinica' });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${frontendUrl}/dashboard/configuracion?upgrade=success`,
      cancel_url:  `${frontendUrl}/dashboard/configuracion?upgrade=cancelled`,
      metadata: {
        business_id: String(req.business.id),
        plan,
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('[billing] Error al crear checkout:', err.message);
    res.status(500).json({ error: 'No se pudo iniciar el pago. Verifica la configuración de Stripe.' });
  }
};

// POST /api/billing/webhook  (raw body — ver billing.routes.js)
const webhook = (req, res) => {
  const sig    = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    console.error('[billing] STRIPE_WEBHOOK_SECRET no configurado');
    return res.status(500).json({ error: 'Webhook no configurado' });
  }

  let event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    console.error('[billing] Firma de webhook inválida:', err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  if (event.type === 'checkout.session.completed') {
    const session    = event.data.object;
    const { business_id, plan } = session.metadata || {};

    const VALID_PLANS = ['pro', 'clinica'];
    if (business_id && VALID_PLANS.includes(plan)) {
      db.prepare('UPDATE businesses SET plan = ? WHERE id = ?').run(plan, parseInt(business_id));
      console.log(`[billing] Plan actualizado a '${plan}' para business #${business_id}`);
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    // Downgrade a basic si cancela la suscripción
    const sub = event.data.object;
    const businessId = sub.metadata?.business_id;
    if (businessId) {
      db.prepare("UPDATE businesses SET plan = 'basic' WHERE id = ?").run(parseInt(businessId));
      console.log(`[billing] Plan revertido a 'basic' para business #${businessId}`);
    }
  }

  res.json({ received: true });
};

// GET /api/billing/plans  — precios/features de cada plan (no requiere Stripe)
const getPlans = (_req, res) => {
  res.json({
    plans: [
      {
        id:       'basic',
        name:     'Básico',
        price:    0,
        currency: 'CLP',
        features: ['Agenda ilimitada', 'Reservas públicas', 'Hasta 2 servicios'],
      },
      {
        id:       'pro',
        name:     'Pro',
        price:    19990,
        currency: 'CLP',
        features: ['Todo lo de Básico', 'Notificaciones WhatsApp', 'Analytics', 'Profesionales múltiples'],
        stripePriceId: PLAN_PRICE_IDS.pro || null,
      },
      {
        id:       'clinica',
        name:     'Clínica',
        price:    49990,
        currency: 'CLP',
        features: ['Todo lo de Pro', 'Expediente clínico', 'Recetas digitales', 'Historial de pacientes'],
        stripePriceId: PLAN_PRICE_IDS.clinica || null,
      },
    ],
  });
};

module.exports = { createCheckout, webhook, getPlans };
