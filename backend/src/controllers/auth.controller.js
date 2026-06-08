const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
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
    {
      id: business.id,
      email: business.owner_email,
      slug: business.slug,
      vertical: business.vertical || 'salud',
      tv: business.token_version ?? 0,
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

const VALID_VERTICALS = ['salud', 'belleza', 'general'];

const register = async (req, res) => {
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

  try {
    const { rows: existing } = await db.query(
      'SELECT id FROM businesses WHERE owner_email = $1',
      [owner_email.toLowerCase()]
    );
    if (existing.length) return res.status(409).json({ error: 'Email ya registrado' });

    const safeVertical = VALID_VERTICALS.includes(vertical) ? vertical : 'salud';
    const password_hash = bcrypt.hashSync(password, 12);
    let slug = slugify(name.trim());
    if (!slug) slug = `negocio-${Date.now()}`;

    const { rows: slugRows } = await db.query('SELECT id FROM businesses WHERE slug = $1', [slug]);
    if (slugRows.length) slug = `${slug}-${Date.now()}`;

    const { rows } = await db.query(
      `INSERT INTO businesses (slug, name, owner_email, password_hash, phone, plan, specialty, vertical)
       VALUES ($1, $2, $3, $4, $5, 'basic', $6, $7)
       RETURNING *`,
      [slug, name.trim(), owner_email.toLowerCase(), password_hash, phone?.trim() || null, specialty || 'general', safeVertical]
    );
    const business = rows[0];
    const token = generateToken(business);

    res.status(201).json({
      token,
      business: { id: business.id, name: business.name, slug: business.slug, plan: business.plan, vertical: business.vertical, specialty: business.specialty },
    });
  } catch (err) {
    console.error('[auth] register error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const login = async (req, res) => {
  const { owner_email, password } = req.body;
  if (!owner_email || !password) {
    return res.status(400).json({ error: 'email y contraseña son requeridos' });
  }

  try {
    const { rows } = await db.query(
      'SELECT * FROM businesses WHERE owner_email = $1',
      [typeof owner_email === 'string' ? owner_email.toLowerCase() : '']
    );
    const business = rows[0];

    const hashToCompare = business ? business.password_hash : DUMMY_HASH;
    const valid = bcrypt.compareSync(typeof password === 'string' ? password : '', hashToCompare);

    if (!business || !valid) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = generateToken(business);
    res.json({
      token,
      business: { id: business.id, name: business.name, slug: business.slug, plan: business.plan, vertical: business.vertical || 'salud', specialty: business.specialty || 'general' },
    });
  } catch (err) {
    console.error('[auth] login error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const me = async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, slug, name, owner_email, phone, plan, vertical, specialty, created_at FROM businesses WHERE id = $1',
      [req.business.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Negocio no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[auth] me error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

function getMailer() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

const forgotPassword = async (req, res) => {
  const { owner_email } = req.body;
  if (!owner_email || !EMAIL_RE.test(owner_email)) {
    return res.status(400).json({ error: 'email inválido' });
  }

  try {
    const { rows } = await db.query(
      'SELECT id, owner_email, name FROM businesses WHERE owner_email = $1',
      [owner_email.toLowerCase()]
    );
    if (!rows[0]) return res.json({ ok: true });
    const business = rows[0];

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await db.query(
      'UPDATE businesses SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
      [tokenHash, expires, business.id]
    );

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`;
    const safeName = escapeHtml(business.name);
    const safeUrl = escapeHtml(resetUrl);

    try {
      await getMailer().sendMail({
        from: process.env.SMTP_USER,
        to: business.owner_email,
        subject: 'Recuperar contraseña — AgendaSaaS',
        text: `Hola ${business.name},\n\nHaz clic en el siguiente enlace para restablecer tu contraseña (válido por 1 hora):\n\n${resetUrl}\n\nSi no solicitaste esto, ignora este email.`,
        html: `<p>Hola <strong>${safeName}</strong>,</p><p>Haz clic aquí para restablecer tu contraseña (válido por 1 hora):</p><p><a href="${safeUrl}">${safeUrl}</a></p><p>Si no solicitaste esto, ignora este email.</p>`,
      });
    } catch (err) {
      console.error('[auth] Error enviando email de reset:', err.message);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[auth] forgotPassword error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const resetPassword = async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'token y password son requeridos' });
  if (typeof token !== 'string' || token.length < 16 || token.length > 256) {
    return res.status(400).json({ error: 'Token inválido o expirado' });
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: 'la contraseña debe tener entre 8 y 128 caracteres' });
  }

  try {
    const { rows } = await db.query(
      'SELECT id, reset_token_expires FROM businesses WHERE reset_token = $1',
      [hashToken(token)]
    );
    if (!rows[0]) return res.status(400).json({ error: 'Token inválido o expirado' });
    if (new Date(rows[0].reset_token_expires) < new Date()) {
      return res.status(400).json({ error: 'Token expirado' });
    }

    const password_hash = bcrypt.hashSync(password, 12);
    await db.query(
      'UPDATE businesses SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
      [password_hash, rows[0].id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[auth] resetPassword error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const logout = async (req, res) => {
  try {
    await db.query('UPDATE businesses SET token_version = token_version + 1 WHERE id = $1', [req.business.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[auth] logout error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { register, login, me, forgotPassword, resetPassword, logout };
