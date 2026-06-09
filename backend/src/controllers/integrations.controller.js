const jwt = require('jsonwebtoken');
const { getAuthUrl, getTokens } = require('../services/googleCalendar');
const db = require('../db/database');

function frontendUrl() {
  return (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
}

const connectGoogle = async (req, res) => {
  try {
    // state = short-lived JWT carrying the businessId, validated on callback (CSRF protection)
    const state = jwt.sign({ businessId: req.business.id }, process.env.JWT_SECRET, { expiresIn: '10m' });
    const url = getAuthUrl(state);

    if (!url) {
      return res.status(500).json({ error: 'Google Calendar no está configurado' });
    }

    res.json({ url });
  } catch (err) {
    console.error('[integrations] connectGoogle error:', err.message);
    res.status(500).json({ error: 'Error iniciando conexión' });
  }
};

const googleCallback = async (req, res) => {
  const { code, state } = req.query;
  const redirectBase = `${frontendUrl()}/dashboard/configuracion`;

  try {
    if (!code || !state) {
      return res.redirect(`${redirectBase}?google=error`);
    }

    let businessId;
    try {
      ({ businessId } = jwt.verify(state, process.env.JWT_SECRET));
    } catch {
      return res.redirect(`${redirectBase}?google=error`);
    }

    const tokens = await getTokens(code);

    await db.query(
      `INSERT INTO integrations (business_id, type, access_token, refresh_token, token_expiry, active)
       VALUES ($1, 'google_calendar', $2, $3, $4, true)
       ON CONFLICT (business_id, type) DO UPDATE
       SET access_token = EXCLUDED.access_token,
           refresh_token = COALESCE(EXCLUDED.refresh_token, integrations.refresh_token),
           token_expiry = EXCLUDED.token_expiry,
           active = true`,
      [
        businessId,
        tokens.access_token,
        tokens.refresh_token || null,
        tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      ]
    );

    res.redirect(`${redirectBase}?google=connected`);
  } catch (err) {
    console.error('[integrations] googleCallback error:', err.message);
    res.redirect(`${redirectBase}?google=error`);
  }
};

const disconnectGoogle = async (req, res) => {
  try {
    await db.query(
      `UPDATE integrations SET active = false WHERE business_id = $1 AND type = 'google_calendar'`,
      [req.business.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[integrations] disconnectGoogle error:', err.message);
    res.status(500).json({ error: 'Error desconectando' });
  }
};

const getStatus = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT active, created_at FROM integrations WHERE business_id = $1 AND type = 'google_calendar'`,
      [req.business.id]
    );
    res.json({ connected: rows[0]?.active || false, connectedAt: rows[0]?.created_at || null });
  } catch (err) {
    console.error('[integrations] getStatus error:', err.message);
    res.status(500).json({ error: 'Error obteniendo status' });
  }
};

module.exports = { connectGoogle, googleCallback, disconnectGoogle, getStatus };
