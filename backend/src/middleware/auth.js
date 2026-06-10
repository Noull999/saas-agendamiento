const jwt = require('jsonwebtoken');
const db = require('../db/database');

async function authMiddleware(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  const token = header.slice(7);
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }

  try {
    const { rows } = await db.query(
      'SELECT id, token_version, plan, subscription_status, trial_ends_at FROM businesses WHERE id = $1',
      [payload.id]
    );
    const business = rows[0];
    if (!business) return res.status(401).json({ error: 'Token inválido o expirado' });

    const tokenVersion = payload.tv ?? 0;
    if (tokenVersion !== business.token_version) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }

    // Estado de suscripción: trial activo da acceso completo (plan business);
    // trial vencido o suscripción cancelada bloquea todo excepto auth y billing
    // para que el usuario pueda ver su cuenta y contratar un plan.
    const status = business.subscription_status || 'active';
    const trialActive = status === 'trial' &&
      business.trial_ends_at && new Date(business.trial_ends_at) > new Date();

    if (status !== 'active' && !trialActive) {
      const allowed = req.originalUrl.startsWith('/api/auth') || req.originalUrl.startsWith('/api/billing');
      if (!allowed) {
        return res.status(402).json({
          error: 'Tu período de prueba terminó. Contrata un plan para seguir usando la plataforma.',
          code: 'subscription_required',
          upgradeUrl: '/dashboard/configuracion',
        });
      }
    }

    // plan se lee siempre de la DB (no del JWT) para que un upgrade
    // aplique de inmediato sin necesidad de re-login
    req.business = {
      ...payload,
      plan: trialActive ? 'business' : (business.plan || 'basic'),
      subscription_status: status,
      trial_ends_at: business.trial_ends_at,
    };
    next();
  } catch (err) {
    console.error('[auth] DB error:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = authMiddleware;
