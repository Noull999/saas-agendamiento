const db = require('../db/database');
const { DEFAULTS } = require('../services/messageTemplates');

const VALID_VERTICALS = ['salud', 'belleza', 'general'];

const getProfile = async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, slug, name, owner_email, phone, plan, description, vertical, created_at FROM businesses WHERE id = $1',
      [req.business.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Negocio no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[settings] getProfile error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const updateProfile = async (req, res) => {
  const { name, phone, description, vertical } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
  if (vertical && !VALID_VERTICALS.includes(vertical)) {
    return res.status(400).json({ error: 'Vertical inválido' });
  }
  try {
    await db.query(`
      UPDATE businesses SET name = $1, phone = $2, description = $3, vertical = COALESCE($4, vertical) WHERE id = $5
    `, [name.trim(), phone || null, description || '', vertical || null, req.business.id]);

    const { rows } = await db.query(
      'SELECT id, slug, name, owner_email, phone, plan, description, vertical, created_at FROM businesses WHERE id = $1',
      [req.business.id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('[settings] updateProfile error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const getTemplates = async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT type, channel, content FROM message_templates WHERE business_id = $1',
      [req.business.id]
    );
    const result = {};
    for (const [type, channels] of Object.entries(DEFAULTS)) {
      result[type] = {};
      for (const [channel, defaultContent] of Object.entries(channels)) {
        const custom = rows.find(r => r.type === type && r.channel === channel);
        result[type][channel] = { content: custom?.content || defaultContent, customized: !!custom };
      }
    }
    res.json(result);
  } catch (err) {
    console.error('[settings] getTemplates error:', err.message);
    res.status(500).json({ error: 'Error interno' });
  }
};

const updateTemplate = async (req, res) => {
  const { type, channel, content } = req.body;
  const VALID_TYPES = ['booking_confirmation', 'reminder', 'cancellation'];
  const VALID_CHANNELS = ['whatsapp', 'email_subject', 'email_body'];
  if (!VALID_TYPES.includes(type) || !VALID_CHANNELS.includes(channel)) {
    return res.status(400).json({ error: 'type o channel inválido' });
  }
  if (!content || typeof content !== 'string' || content.length > 2000) {
    return res.status(400).json({ error: 'content inválido (max 2000 chars)' });
  }
  try {
    await db.query(`
      INSERT INTO message_templates (business_id, type, channel, content, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (business_id, type, channel) DO UPDATE SET content = $4, updated_at = NOW()
    `, [req.business.id, type, channel, content]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[settings] updateTemplate error:', err.message);
    res.status(500).json({ error: 'Error interno' });
  }
};

module.exports = { getProfile, updateProfile, getTemplates, updateTemplate };
