const db = require('../db/database');

const getProfile = (req, res) => {
  const business = db.prepare(
    'SELECT id, slug, name, owner_email, phone, plan, description, created_at FROM businesses WHERE id = ?'
  ).get(req.business.id);
  if (!business) return res.status(404).json({ error: 'Negocio no encontrado' });
  res.json(business);
};

const updateProfile = (req, res) => {
  const { name, phone, description } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre es requerido' });

  db.prepare(`
    UPDATE businesses SET name = ?, phone = ?, description = ? WHERE id = ?
  `).run(name.trim(), phone || null, description || '', req.business.id);

  const updated = db.prepare(
    'SELECT id, slug, name, owner_email, phone, plan, description, created_at FROM businesses WHERE id = ?'
  ).get(req.business.id);
  res.json(updated);
};

module.exports = { getProfile, updateProfile };
