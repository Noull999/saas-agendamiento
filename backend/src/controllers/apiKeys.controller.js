const crypto = require('node:crypto');
const db = require('../db/database');

function generateApiKey() {
  const randomBytes = crypto.randomBytes(24).toString('hex');
  return `sk_live_${randomBytes.substring(0, 24)}`;
}

const createApiKey = async (req, res) => {
  const { name } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length < 3 || name.trim().length > 100) {
    return res.status(400).json({ error: 'name inválido (3-100 chars)' });
  }

  try {
    const key = generateApiKey();
    const keyHash = crypto.createHash('sha256').update(key).digest('hex');
    const keyPrefix = key.substring(0, 8);

    const { rows } = await db.query(
      `INSERT INTO api_keys (business_id, name, key_hash, key_prefix)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, key_prefix, created_at`,
      [req.business.id, name.trim(), keyHash, keyPrefix]
    );

    res.json({
      id: rows[0].id,
      name: rows[0].name,
      key_prefix: rows[0].key_prefix,
      key: key, // Only shown once
      created_at: rows[0].created_at,
    });
  } catch (err) {
    console.error('[apiKeys] createApiKey error:', err.message);
    res.status(500).json({ error: 'Error creando API key' });
  }
};

const listApiKeys = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, name, key_prefix, last_used, created_at, active
       FROM api_keys
       WHERE business_id = $1
       ORDER BY created_at DESC`,
      [req.business.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[apiKeys] listApiKeys error:', err.message);
    res.status(500).json({ error: 'Error obteniendo API keys' });
  }
};

const revokeApiKey = async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await db.query(
      `UPDATE api_keys
       SET active = false
       WHERE id = $1 AND business_id = $2
       RETURNING id`,
      [id, req.business.id]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'API key no encontrada' });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[apiKeys] revokeApiKey error:', err.message);
    res.status(500).json({ error: 'Error revocando API key' });
  }
};

module.exports = { createApiKey, listApiKeys, revokeApiKey };
