const db = require('../db/database');

const list = (req, res) => {
  const services = db.prepare(
    'SELECT * FROM services WHERE business_id = ? ORDER BY id ASC'
  ).all(req.business.id);
  res.json(services);
};

const create = (req, res) => {
  const { name, description, duration_min, price } = req.body;
  if (!name) return res.status(400).json({ error: 'nombre es requerido' });

  const result = db.prepare(`
    INSERT INTO services (business_id, name, description, duration_min, price)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.business.id, name, description || null, duration_min || 60, price || null);

  const service = db.prepare('SELECT * FROM services WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(service);
};

const update = (req, res) => {
  const { id } = req.params;
  const service = db.prepare('SELECT * FROM services WHERE id = ? AND business_id = ?').get(id, req.business.id);
  if (!service) return res.status(404).json({ error: 'Servicio no encontrado' });

  const { name, description, duration_min, price, active } = req.body;
  db.prepare(`
    UPDATE services SET
      name = ?, description = ?, duration_min = ?, price = ?, active = ?
    WHERE id = ?
  `).run(
    name ?? service.name,
    description ?? service.description,
    duration_min ?? service.duration_min,
    price ?? service.price,
    active ?? service.active,
    id
  );

  res.json(db.prepare('SELECT * FROM services WHERE id = ?').get(id));
};

const remove = (req, res) => {
  const { id } = req.params;
  const service = db.prepare('SELECT id FROM services WHERE id = ? AND business_id = ?').get(id, req.business.id);
  if (!service) return res.status(404).json({ error: 'Servicio no encontrado' });

  db.prepare('DELETE FROM services WHERE id = ?').run(id);
  res.json({ ok: true });
};

module.exports = { list, create, update, remove };
