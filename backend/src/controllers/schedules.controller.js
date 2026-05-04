const db = require('../db/database');

const DOW_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const TIME_RE = /^\d{2}:\d{2}$/;

function safeParseSlots(raw) {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const list = (req, res) => {
  const rows = db.prepare('SELECT * FROM schedules WHERE business_id = ? ORDER BY dow ASC').all(req.business.id);
  const result = rows.map(r => ({ ...r, slots: safeParseSlots(r.slots), day_name: DOW_NAMES[r.dow] }));
  res.json(result);
};

const upsert = (req, res) => {
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

  db.prepare(`
    INSERT INTO schedules (business_id, dow, slots)
    VALUES (?, ?, ?)
    ON CONFLICT(business_id, dow) DO UPDATE SET slots = excluded.slots
  `).run(req.business.id, dowNum, JSON.stringify(validSlots));

  const row = db.prepare('SELECT * FROM schedules WHERE business_id = ? AND dow = ?').get(req.business.id, dowNum);
  res.json({ ...row, slots: safeParseSlots(row.slots), day_name: DOW_NAMES[row.dow] });
};

const remove = (req, res) => {
  const dowNum = Number(req.params.dow);
  if (!Number.isInteger(dowNum) || dowNum < 0 || dowNum > 6) {
    return res.status(400).json({ error: 'dow inválido' });
  }
  db.prepare('DELETE FROM schedules WHERE business_id = ? AND dow = ?').run(req.business.id, dowNum);
  res.json({ ok: true });
};

module.exports = { list, upsert, remove };
