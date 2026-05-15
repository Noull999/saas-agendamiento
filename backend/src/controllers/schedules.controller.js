const pool = require('../db/database');

const DOW_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const TIME_RE = /^\d{2}:\d{2}$/;

function safeParseSlots(raw) {
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const list = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM schedules WHERE business_id = $1 ORDER BY dow ASC', [req.business.id]);
    const rows = result.rows.map(r => ({ ...r, slots: safeParseSlots(r.slots), day_name: DOW_NAMES[r.dow] }));
    res.json(rows);
  } catch (err) {
    console.error('[schedules] List error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const upsert = async (req, res) => {
  const { dow, slots } = req.body;

  if (dow === undefined || !Array.isArray(slots)) {
    return res.status(400).json({ error: 'dow (0-6) y slots (array) son requeridos' });
  }
  const dowNum = Number(dow);
  if (!Number.isInteger(dowNum) || dowNum < 0 || dowNum > 6) {
    return res.status(400).json({ error: 'dow debe ser un entero entre 0 (domingo) y 6 (sábado)' });
  }
  if (slots.length > 48) {
    return res.status(400).json({ error: 'máximo 48 slots por día' });
  }
  const validSlots = slots.filter(s => typeof s === 'string' && TIME_RE.test(s));

  try {
    await pool.query(`
      INSERT INTO schedules (business_id, dow, slots, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
      ON CONFLICT(business_id, dow) DO UPDATE SET slots = $3, updated_at = NOW()
    `, [req.business.id, dowNum, JSON.stringify(validSlots)]);

    const result = await pool.query('SELECT * FROM schedules WHERE business_id = $1 AND dow = $2', [req.business.id, dowNum]);
    const row = result.rows[0];
    res.json({ ...row, slots: safeParseSlots(row.slots), day_name: DOW_NAMES[row.dow] });
  } catch (err) {
    console.error('[schedules] Upsert error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const remove = async (req, res) => {
  const dowNum = Number(req.params.dow);
  if (!Number.isInteger(dowNum) || dowNum < 0 || dowNum > 6) {
    return res.status(400).json({ error: 'dow inválido' });
  }

  try {
    await pool.query('DELETE FROM schedules WHERE business_id = $1 AND dow = $2', [req.business.id, dowNum]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[schedules] Delete error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { list, upsert, remove };
