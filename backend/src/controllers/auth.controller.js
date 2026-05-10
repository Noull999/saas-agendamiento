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
    { id: business.id, email: business.owner_email, slug: business.slug, vertical: business.vertical || 'salud' },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

const VALID_VERTICALS = ['salud', 'belleza'];

const register = (req, res) => {
  const { name, owner_email, password, phone, specialty, vertical } = req.body;

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

  const safeVertical = VALID_VERTICALS.includes(vertical) ? vertical : 'salud';
  const password_hash = bcrypt.hashSync(password, 12);
  let slug = slugify(name.trim());
  if (!slug) slug = `negocio-${Date.now()}`;

  const slugExists = db.prepare('SELECT id FROM businesses WHERE slug = ?').get(slug);
  if (slugExists) slug = `${slug}-${Date.now()}`;

  const result = db.prepare(`
    INSERT INTO businesses (slug, name, owner_email, password_hash, phone, plan, specialty, vertical)
    VALUES (?, ?, ?, ?, ?, 'basic', ?, ?)
  `).run(slug, name.trim(), owner_email.toLowerCase(), password_hash, phone?.trim() || null, specialty || 'general', safeVertical);

  const business = db.prepare('SELECT * FROM businesses WHERE id = ?').get(result.lastInsertRowid);
  const token = generateToken(business);

  res.status(201).json({
    token,
    business: { id: business.id, name: business.name, slug: business.slug, plan: business.plan, vertical: business.vertical, specialty: business.specialty }
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
    business: { id: business.id, name: business.name, slug: business.slug, plan: business.plan, vertical: business.vertical || 'salud', specialty: business.specialty || 'general' }
  });
};

const me = (req, res) => {
  const business = db.prepare(
    'SELECT id, slug, name, owner_email, phone, plan, vertical, specialty, created_at FROM businesses WHERE id = ?'
  ).get(req.business.id);
  if (!business) return res.status(404).json({ error: 'Negocio no encontrado' });
  res.json(business);
};

const crypto = require('crypto');
const nodemailer = require('nodemailer');

function getMailer() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

const forgotPassword = async (req, res) => {
  const { owner_email } = req.body;
  if (!owner_email || !EMAIL_RE.test(owner_email)) {
    return res.status(400).json({ error: 'email inválido' });
  }

  const business = db.prepare('SELECT id, owner_email, name FROM businesses WHERE owner_email = ?').get(
    owner_email.toLowerCase()
  );

  if (!business) return res.json({ ok: true });

  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  db.prepare('UPDATE businesses SET reset_token = ?, reset_token_expires = ? WHERE id = ?').run(
    token, expires, business.id
  );

  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`;

  try {
    await getMailer().sendMail({
      from: process.env.SMTP_USER,
      to: business.owner_email,
      subject: 'Recuperar contraseña — AgendaSaaS',
      text: `Hola ${business.name},\n\nHaz clic en el siguiente enlace para restablecer tu contraseña (válido por 1 hora):\n\n${resetUrl}\n\nSi no solicitaste esto, ignora este email.`,
      html: `<p>Hola <strong>${business.name}</strong>,</p><p>Haz clic aquí para restablecer tu contraseña (válido por 1 hora):</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>Si no solicitaste esto, ignora este email.</p>`,
    });
  } catch (err) {
    console.error('[auth] Error enviando email de reset:', err.message);
  }

  res.json({ ok: true });
};

const resetPassword = (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'token y password son requeridos' });
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: 'la contraseña debe tener entre 8 y 128 caracteres' });
  }

  const business = db.prepare(
    'SELECT id, reset_token_expires FROM businesses WHERE reset_token = ?'
  ).get(token);

  if (!business) return res.status(400).json({ error: 'Token inválido o expirado' });
  if (new Date(business.reset_token_expires) < new Date()) {
    return res.status(400).json({ error: 'Token expirado' });
  }

  const password_hash = bcrypt.hashSync(password, 12);
  db.prepare('UPDATE businesses SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?').run(
    password_hash, business.id
  );

  res.json({ ok: true });
};

module.exports = { register, login, me, forgotPassword, resetPassword };
