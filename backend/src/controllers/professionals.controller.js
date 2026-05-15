const pool = require('../db/database');

const getOne = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM professionals WHERE id = $1 AND business_id = $2 AND active = true',
      [req.params.id, req.business.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Profesional no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[professionals] GetOne error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const list = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM professionals WHERE business_id = $1 AND active = true ORDER BY name ASC',
      [req.business.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[professionals] List error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const create = async (req, res) => {
  try {
    const { name, specialty, email } = req.body;
    if (!name || !specialty) return res.status(400).json({ error: 'name y specialty son requeridos' });

    const insertResult = await pool.query(
      'INSERT INTO professionals (business_id, name, specialty, email, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id',
      [req.business.id, name.trim(), specialty.trim(), email || null]
    );

    const professionalId = insertResult.rows[0].id;
    const result = await pool.query('SELECT * FROM professionals WHERE id = $1', [professionalId]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[professionals] Create error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const update = async (req, res) => {
  try {
    const profResult = await pool.query(
      'SELECT * FROM professionals WHERE id = $1 AND business_id = $2 AND active = true',
      [req.params.id, req.business.id]
    );
    if (profResult.rows.length === 0) return res.status(404).json({ error: 'Profesional no encontrado' });

    const prof = profResult.rows[0];
    const { name, specialty, email } = req.body;

    await pool.query(
      'UPDATE professionals SET name = $1, specialty = $2, email = $3, updated_at = NOW() WHERE id = $4',
      [
        name !== undefined ? name.trim() : prof.name,
        specialty !== undefined ? specialty.trim() : prof.specialty,
        email !== undefined ? email : prof.email,
        prof.id
      ]
    );

    const result = await pool.query('SELECT * FROM professionals WHERE id = $1', [prof.id]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[professionals] Update error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const remove = async (req, res) => {
  try {
    const prof = await pool.query('SELECT id FROM professionals WHERE id = $1 AND business_id = $2', [req.params.id, req.business.id]);
    if (prof.rows.length === 0) return res.status(404).json({ error: 'Profesional no encontrado' });

    await pool.query('UPDATE professionals SET active = false, updated_at = NOW() WHERE id = $1', [prof.rows[0].id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[professionals] Delete error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getOne, list, create, update, remove };
