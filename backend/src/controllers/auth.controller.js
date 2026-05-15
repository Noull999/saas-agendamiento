const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/database');

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
    {
      id: business.id,
      email: business.email,
      vertical: business.plan || 'basic',
      tv: 0,
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

const register = async (req, res) => {
  const { email, password, phone, plan } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email y contraseña son requeridos' });
  }
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return res.status(400).json({ error: 'email inválido' });
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: 'la contraseña debe tener entre 8 y 128 caracteres' });
  }

  try {
    const existing = await pool.query('SELECT id FROM businesses WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email ya registrado' });
    }

    const password_hash = bcrypt.hashSync(password, 12);
    const safePlan = plan && ['basic', 'pro', 'clinica'].includes(plan) ? plan : 'basic';

    const result = await pool.query(
      'INSERT INTO businesses (email, password_hash, phone, plan, active, created_at, updated_at) VALUES ($1, $2, $3, $4, true, NOW(), NOW()) RETURNING *',
      [email.toLowerCase(), password_hash, phone || null, safePlan]
    );

    const business = result.rows[0];
    const token = generateToken(business);

    res.status(201).json({
      token,
      business: { id: business.id, email: business.email, plan: business.plan }
    });
  } catch (err) {
    console.error('[AUTH] Register error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email y contraseña son requeridos' });
  }

  try {
    const result = await pool.query('SELECT * FROM businesses WHERE email = $1', [
      typeof email === 'string' ? email.toLowerCase() : ''
    ]);
    const business = result.rows[0];

    const hashToCompare = business ? business.password_hash : DUMMY_HASH;
    const valid = bcrypt.compareSync(typeof password === 'string' ? password : '', hashToCompare);

    if (!business || !valid) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = generateToken(business);
    res.json({
      token,
      business: { id: business.id, email: business.email, plan: business.plan }
    });
  } catch (err) {
    console.error('[AUTH] Login error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const me = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, phone, plan, created_at FROM businesses WHERE id = $1',
      [req.business.id]
    );
    const business = result.rows[0];
    if (!business) return res.status(404).json({ error: 'Negocio no encontrado' });
    res.json(business);
  } catch (err) {
    console.error('[AUTH] Me error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
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

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

const forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'email inválido' });
  }

  try {
    const result = await pool.query('SELECT id, email FROM businesses WHERE email = $1', [
      email.toLowerCase()
    ]);
    const business = result.rows[0];

    if (!business) return res.json({ ok: true });

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await pool.query(
      'INSERT INTO password_resets (business_id, token_hash, expires_at, created_at) VALUES ($1, $2, $3, NOW())',
      [business.id, tokenHash, expires]
    );

    console.log(`[AUTH] Reset token created for ${business.email}`);
    return res.json({ ok: true });
  } catch (err) {
    console.error('[AUTH] Forgot password error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const resetPassword = async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ error: 'token y contraseña son requeridos' });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'contraseña debe tener mínimo 8 caracteres' });
  }

  try {
    const tokenHash = hashToken(token);
    const result = await pool.query(
      'SELECT business_id FROM password_resets WHERE token_hash = $1 AND expires_at > NOW()',
      [tokenHash]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Token inválido o expirado' });
    }

    const businessId = result.rows[0].business_id;
    const newHash = bcrypt.hashSync(password, 12);

    await pool.query('UPDATE businesses SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
      newHash,
      businessId
    ]);

    await pool.query('DELETE FROM password_resets WHERE token_hash = $1', [tokenHash]);

    res.json({ ok: true });
  } catch (err) {
    console.error('[AUTH] Reset password error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = {
  register,
  login,
  me,
  forgotPassword,
  resetPassword,
};
