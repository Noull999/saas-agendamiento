const pool = require('../db/database');

const list = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM services WHERE business_id = $1 ORDER BY id ASC',
      [req.business.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[services] List error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const create = async (req, res) => {
  const { name, description, duration_min, price } = req.body;
  if (!name) return res.status(400).json({ error: 'nombre es requerido' });

  try {
    const result = await pool.query(
      `INSERT INTO services (business_id, name, description, duration_min, price)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.business.id, name, description || null, duration_min || 60, price || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[services] Create error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const update = async (req, res) => {
  const { id } = req.params;

  try {
    const existing = await pool.query(
      'SELECT * FROM services WHERE id = $1 AND business_id = $2',
      [id, req.business.id]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Servicio no encontrado' });
    }

    const service = existing.rows[0];
    const { name, description, duration_min, price, active } = req.body;

    const result = await pool.query(
      `UPDATE services SET
        name = $1, description = $2, duration_min = $3, price = $4, active = $5, updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [
        name ?? service.name,
        description ?? service.description,
        duration_min ?? service.duration_min,
        price ?? service.price,
        active ?? service.active,
        id
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[services] Update error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const remove = async (req, res) => {
  const { id } = req.params;

  try {
    const existing = await pool.query(
      'SELECT id FROM services WHERE id = $1 AND business_id = $2',
      [id, req.business.id]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Servicio no encontrado' });
    }

    await pool.query('DELETE FROM services WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[services] Delete error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { list, create, update, remove };
