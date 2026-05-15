const pool = require('../db/database');

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY no configurada');
  }
  return require('stripe')(process.env.STRIPE_SECRET_KEY);
}

const PLAN_PRICE_IDS = {
  pro:      process.env.STRIPE_PRICE_PRO,
  business: process.env.STRIPE_PRICE_BUSINESS,
};

// POST /api/billing/checkout
// Body: { plan: 'pro' | 'business' }
const createCheckout = async (req, res) => {
  try {
    const stripe  = getStripe();
    const { plan } = req.body;
    const priceId  = PLAN_PRICE_IDS[plan];

    if (!priceId) {
      return res.status(400).json({ error: 'Plan inválido. Valores aceptados: pro, business' });
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
const webhook = async (req, res) => {
  try {
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
      const session = event.data.object;
      const { business_id, plan } = session.metadata || {};

      const VALID_PLANS = ['pro', 'business'];
      if (business_id && VALID_PLANS.includes(plan)) {
        await pool.query('UPDATE businesses SET plan = $1 WHERE id = $2', [plan, parseInt(business_id)]);
        console.log(`[billing] Plan actualizado a '${plan}' para business #${business_id}`);
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object;
      const businessId = sub.metadata?.business_id;
      if (businessId) {
        await pool.query('UPDATE businesses SET plan = $1 WHERE id = $2', ['basic', parseInt(businessId)]);
        console.log(`[billing] Plan revertido a 'basic' para business #${businessId}`);
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('[billing] Webhook error:', err);
    res.status(500).json({ error: 'Error procesando webhook' });
  }
};

// GET /api/billing/plans
const getPlans = (_req, res) => {
  res.json({
    plans: [
      {
        id:       'basic',
        name:     'Basic',
        price:    9990,
        currency: 'CLP',
        features: [
          '1 profesional',
          'Hasta 100 reservas/mes',
          'Página de reservas pública',
          'Soporte por email',
        ],
      },
      {
        id:       'pro',
        name:     'Pro',
        price:    19990,
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
        stripePriceId: PLAN_PRICE_IDS.pro || null,
      },
      {
        id:       'business',
        name:     'Business',
        price:    34990,
        currency: 'CLP',
        features: [
          'Todo lo de Pro',
          'Bot IA para reservar por WhatsApp',
          'Profesionales ilimitados',
          'Múltiples sedes',
          'Onboarding personalizado',
        ],
        stripePriceId: PLAN_PRICE_IDS.business || null,
      },
    ],
  });
};

module.exports = { createCheckout, webhook, getPlans };
