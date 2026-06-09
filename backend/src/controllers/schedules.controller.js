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

const list = async (req, res) => {
  const { location_id } = req.query;
  try {
    let query = 'SELECT * FROM schedules WHERE business_id = $1';
    const params = [req.business.id];
    if (location_id) {
      query += ' AND location_id = $2';
      params.push(location_id);
    } else {
      query += ' AND location_id IS NULL';
    }
    query += ' ORDER BY dow ASC';
    const { rows } = await db.query(query, params);
    const result = rows.map(r => ({ ...r, slots: safeParseSlots(r.slots), day_name: DOW_NAMES[r.dow] }));
    res.json(result);
  } catch (err) {
    console.error('[schedules] list error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const upsert = async (req, res) => {
  const { dow, slots, location_id } = req.body;

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

  // Validate location_id if provided
  let safeLocationId = location_id || null;
  if (safeLocationId) {
    const { rows: locRows } = await db.query(
      'SELECT id FROM locations WHERE id = $1 AND business_id = $2',
      [safeLocationId, req.business.id]
    );
    if (!locRows[0]) return res.status(404).json({ error: 'Sucursal no encontrada' });
    safeLocationId = locRows[0].id;
  }

  try {
    // The UNIQUE(business_id, dow) constraint doesn't cover location_id,
    // so we do a manual upsert keyed on (business_id, dow, location_id).
    const { rows: existing } = await db.query(
      'SELECT id FROM schedules WHERE business_id = $1 AND dow = $2 AND location_id IS NOT DISTINCT FROM $3',
      [req.business.id, dowNum, safeLocationId]
    );

    if (existing.length) {
      await db.query(
        'UPDATE schedules SET slots = $1 WHERE id = $2',
        [JSON.stringify(validSlots), existing[0].id]
      );
    } else {
      await db.query(
        'INSERT INTO schedules (business_id, dow, slots, location_id) VALUES ($1, $2, $3, $4)',
        [req.business.id, dowNum, JSON.stringify(validSlots), safeLocationId]
      );
    }

    const { rows } = await db.query(
      'SELECT * FROM schedules WHERE business_id = $1 AND dow = $2 AND location_id IS NOT DISTINCT FROM $3',
      [req.business.id, dowNum, safeLocationId]
    );
    const row = rows[0];
    res.json({ ...row, slots: safeParseSlots(row.slots), day_name: DOW_NAMES[row.dow] });
  } catch (err) {
    console.error('[schedules] upsert error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const remove = async (req, res) => {
  const dowNum = Number(req.params.dow);
  if (!Number.isInteger(dowNum) || dowNum < 0 || dowNum > 6) {
    return res.status(400).json({ error: 'dow inválido' });
  }
  try {
    await db.query('DELETE FROM schedules WHERE business_id = $1 AND dow = $2', [req.business.id, dowNum]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[schedules] remove error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { list, upsert, remove };
