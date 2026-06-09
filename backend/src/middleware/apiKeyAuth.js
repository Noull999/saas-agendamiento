const crypto = require('node:crypto');
const db = require('../db/database');

module.exports = async function apiKeyAuth(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!key) return res.status(401).json({ error: 'API key requerida (header X-API-Key)' });

  try {
    const keyHash = crypto.createHash('sha256').update(key).digest('hex');

    const { rows } = await db.query(
      `SELECT ak.id, ak.business_id,
              b.id as id, b.slug, b.name, b.plan, b.phone, b.description, b.specialty, b.vertical
       FROM api_keys ak
       JOIN businesses b ON b.id = ak.business_id
       WHERE ak.key_hash = $1 AND ak.active = true`,
      [keyHash]
    );

    if (!rows[0]) {
      return res.status(401).json({ error: 'API key inválida o revocada' });
    }

    req.business = rows[0];
    req.apiKeyId = rows[0].id;

    // Update last_used (non-blocking)
    db.query('UPDATE api_keys SET last_used = NOW() WHERE key_hash = $1', [keyHash]).catch(() => {});

    next();
  } catch (err) {
    console.error('[apiKeyAuth] error:', err.message);
    res.status(500).json({ error: 'Error interno' });
  }
};
