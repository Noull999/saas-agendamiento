const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DUMMY_HASH = bcrypt.hashSync('dummy_for_timing_protection', 10);

function slugify(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function generateToken(business) {
  return jwt.sign(
    { id: business.id, email: business.owner_email, slug: business.slug },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

const register = (req, res) => {
  const { name, owner_email, password, phone, specialty } = req.body;

  if (!name || !owner_email || !password) {
    return res.status(400).json({ error: 'nombre, email y contraseña son requeridos' });
  }
  if (typeof name !== 'string' || name.trim().length < 2 || name.length > 100) {
    return res.status(400).json({ error: 'nombre debe tener entre 2 y 100 caracteres' });
  }
  if (!EMAIL_RE.test(owner_email) || owner_email.length > 254) {
    return res.status(400).json({ error: 'email inválido' });
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: 'la contraseña debe tener entre 8 y 128 caracteres' });
  }
  if (phone && (typeof phone !== 'string' || phone.length > 30)) {
    return res.status(400).json({ error: 'teléfono inválido' });
  }

  const existing = db.prepare('SELECT id FROM businesses WHERE owner_email = ?').get(owner_email);
  if (existing) {
    return res.status(409).json({ error: 'Email ya registrado' });
  }

  const password_hash = bcrypt.hashSync(password, 12);
  let slug = slugify(name.trim());
  if (!slug) slug = `negocio-${Date.now()}`;

  const slugExists = db.prepare('SELECT id FROM businesses WHERE slug = ?').get(slug);
  if (slugExists) slug = `${slug}-${Date.now()}`;

  const result = db.prepare(`
    INSERT INTO businesses (slug, name, owner_email, password_hash, phone, plan, specialty)
    VALUES (?, ?, ?, ?, ?, 'basic', ?)
  `).run(slug, name.trim(), owner_email.toLowerCase(), password_hash, phone?.trim() || null, specialty || 'general');

  const business = db.prepare('SELECT * FROM businesses WHERE id = ?').get(result.lastInsertRowid);
  const token = generateToken(business);

  res.status(201).json({
    token,
    business: { id: business.id, name: business.name, slug: business.slug, plan: business.plan }
  });
};

const login = (req, res) => {
  const { owner_email, password } = req.body;

  if (!owner_email || !password) {
    return res.status(400).json({ error: 'email y contraseña son requeridos' });
  }

  const business = db.prepare('SELECT * FROM businesses WHERE owner_email = ?').get(
    typeof owner_email === 'string' ? owner_email.toLowerCase() : ''
  );

  // Siempre ejecuta bcrypt para evitar timing attacks (enumeración de emails)
  const hashToCompare = business ? business.password_hash : DUMMY_HASH;
  const valid = bcrypt.compareSync(typeof password === 'string' ? password : '', hashToCompare);

  if (!business || !valid) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  const token = generateToken(business);
  res.json({
    token,
    business: { id: business.id, name: business.name, slug: business.slug, plan: business.plan }
  });
};

const me = (req, res) => {
  const business = db.prepare(
    'SELECT id, slug, name, owner_email, phone, plan, created_at FROM businesses WHERE id = ?'
  ).get(req.business.id);
  if (!business) return res.status(404).json({ error: 'Negocio no encontrado' });
  res.json(business);
};

module.exports = { register, login, me };
