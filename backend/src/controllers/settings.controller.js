const pool = require('../db/database');

const VALID_VERTICALS = ['salud', 'belleza'];

const getProfile = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, slug, name, owner_email, phone, plan, description, vertical, created_at FROM businesses WHERE id = $1',
      [req.business.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Negocio no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[settings] GetProfile error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { name, phone, description, vertical } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
    if (vertical && !VALID_VERTICALS.includes(vertical)) {
      return res.status(400).json({ error: 'Vertical inválido' });
    }

    await pool.query(`
      UPDATE businesses SET name = $1, phone = $2, description = $3, vertical = COALESCE($4, vertical), updated_at = NOW() WHERE id = $5
    `, [name.trim(), phone || null, description || '', vertical || null, req.business.id]);

    const result = await pool.query(
      'SELECT id, slug, name, owner_email, phone, plan, description, vertical, created_at FROM businesses WHERE id = $1',
      [req.business.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[settings] UpdateProfile error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getProfile, updateProfile };
