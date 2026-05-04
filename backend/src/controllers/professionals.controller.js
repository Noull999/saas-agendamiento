const db = require('../db/database');

const list = (req, res) => {
  const professionals = db.prepare(
    'SELECT * FROM professionals WHERE business_id = ? AND active = 1 ORDER BY name ASC'
  ).all(req.business.id);
  res.json(professionals);
};

const create = (req, res) => {
  const { name, specialty, email } = req.body;
  if (!name || !specialty) return res.status(400).json({ error: 'name y specialty son requeridos' });

  const result = db.prepare(
    'INSERT INTO professionals (business_id, name, specialty, email) VALUES (?, ?, ?, ?)'
  ).run(req.business.id, name.trim(), specialty.trim(), email || null);

  res.status(201).json(db.prepare('SELECT * FROM professionals WHERE id = ?').get(result.lastInsertRowid));
};

const update = (req, res) => {
  const prof = db.prepare('SELECT * FROM professionals WHERE id = ? AND business_id = ?').get(req.params.id, req.business.id);
  if (!prof) return res.status(404).json({ error: 'Profesional no encontrado' });

  const { name, specialty, email } = req.body;
  db.prepare('UPDATE professionals SET name = ?, specialty = ?, email = ? WHERE id = ?').run(
    name !== undefined ? name.trim() : prof.name,
    specialty !== undefined ? specialty.trim() : prof.specialty,
    email !== undefined ? email : prof.email,
    prof.id
  );

  res.json(db.prepare('SELECT * FROM professionals WHERE id = ?').get(prof.id));
};

const remove = (req, res) => {
  const prof = db.prepare('SELECT id FROM professionals WHERE id = ? AND business_id = ?').get(req.params.id, req.business.id);
  if (!prof) return res.status(404).json({ error: 'Profesional no encontrado' });
  db.prepare('UPDATE professionals SET active = 0 WHERE id = ?').run(prof.id);
  res.json({ ok: true });
};

module.exports = { list, create, update, remove };
