const db = require('../db/database');

const list = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM services WHERE business_id = $1 ORDER BY id ASC', [req.business.id]);
    res.json(rows);
  } catch (err) {
    console.error('[services] list error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const create = async (req, res) => {
  const { name, description, duration_min, price } = req.body;
  if (!name) return res.status(400).json({ error: 'nombre es requerido' });
  try {
    const { rows } = await db.query(`
      INSERT INTO services (business_id, name, description, duration_min, price)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [req.business.id, name, description || null, duration_min || 60, price || null]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[services] create error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const update = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows: existing } = await db.query('SELECT * FROM services WHERE id = $1 AND business_id = $2', [id, req.business.id]);
    const service = existing[0];
    if (!service) return res.status(404).json({ error: 'Servicio no encontrado' });

    const { name, description, duration_min, price, active } = req.body;
    await db.query(`
      UPDATE services SET name = $1, description = $2, duration_min = $3, price = $4, active = $5
      WHERE id = $6
    `, [
      name ?? service.name,
      description ?? service.description,
      duration_min ?? service.duration_min,
      price ?? service.price,
      active ?? service.active,
      id,
    ]);

    const { rows: updated } = await db.query('SELECT * FROM services WHERE id = $1', [id]);
    res.json(updated[0]);
  } catch (err) {
    console.error('[services] update error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const remove = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await db.query('SELECT id FROM services WHERE id = $1 AND business_id = $2', [id, req.business.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Servicio no encontrado' });
    await db.query('DELETE FROM services WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[services] remove error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { list, create, update, remove };
