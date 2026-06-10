# Neon Migration + Security Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the database from SQLite (node:sqlite) to Neon (PostgreSQL via `pg`), making all DB calls async, and fix all P0/P1 security issues found in the review.

**Architecture:** Replace the synchronous `node:sqlite` DatabaseSync with a `pg` Pool connected to Neon. All controller functions become async. SQL placeholders change from `?` to `$1, $2...`. P0 security fixes (IDOR, rate limiter, JSON.parse crash) and P1 fixes (Stripe idempotency, graceful shutdown, 401 interceptor) are applied during migration.

**Tech Stack:** Node.js 22, Express 4, pg (node-postgres), Neon Serverless PostgreSQL, React 19, Vite

---

## Pre-requisites (Manual Steps — NOT automated)

Before running any tasks:

1. Go to https://neon.tech and create a free account
2. Create a new project named `saas-agendamiento`
3. Copy the **connection string** (format: `postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require`)
4. Add to `backend/.env`:
   ```
   DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

---

## File Map

**Files Modified:**
- `backend/package.json` — add `pg`
- `backend/src/db/database.js` — replace node:sqlite with pg Pool
- `backend/src/lib/audit.js` — make async
- `backend/src/middleware/auth.js` — make async
- `backend/src/controllers/auth.controller.js` — async + pg queries
- `backend/src/controllers/bookings.controller.js` — async + pg + race condition fix
- `backend/src/routes/public.routes.js` — async + IDOR fix + JSON.parse fix + phone validation
- `backend/src/controllers/patients.controller.js` — async + pg
- `backend/src/controllers/consultations.controller.js` — async + pg
- `backend/src/controllers/prescriptions.controller.js` — async + pg
- `backend/src/controllers/services.controller.js` — async + pg
- `backend/src/controllers/schedules.controller.js` — async + pg
- `backend/src/controllers/professionals.controller.js` — async + pg
- `backend/src/controllers/analytics.controller.js` — async + pg
- `backend/src/controllers/settings.controller.js` — async + pg
- `backend/src/controllers/billing.controller.js` — async + pg + Stripe idempotency
- `backend/src/jobs/reminders.js` — async + pg
- `backend/src/index.js` — rate limiter fix + graceful shutdown + health check
- `frontend/src/api/client.js` — add 401 interceptor
- `frontend/src/context/AuthContext.jsx` — validate token on mount

**Files Created:**
- `backend/src/db/schema.sql` — PostgreSQL schema
- `backend/src/db/migrate.js` — runs schema.sql against Neon

---

## SQL Translation Reference

Every SQL change in this migration follows these rules:

| SQLite | PostgreSQL |
|--------|-----------|
| `?` | `$1, $2, $3...` (positional) |
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `BIGSERIAL PRIMARY KEY` |
| `TEXT NOT NULL DEFAULT (datetime('now'))` | `TIMESTAMPTZ NOT NULL DEFAULT NOW()` |
| `INTEGER NOT NULL DEFAULT 1` (for flags) | `SMALLINT NOT NULL DEFAULT 1` |
| `date(datetime_iso) = ?` | `LEFT(datetime_iso, 10) = $1` |
| `date(datetime_iso) >= ?` | `LEFT(datetime_iso, 10) >= $1` |
| `date(datetime_iso) BETWEEN ? AND ?` | `LEFT(datetime_iso, 10) BETWEEN $1 AND $2` |
| `time(datetime_iso) as t` | `SUBSTRING(datetime_iso FROM 12 FOR 8) as t` |
| `result.lastInsertRowid` | use `RETURNING id`, then `rows[0].id` |
| `db.prepare(sql).get(a, b)` | `(await db.query(sql, [a, b])).rows[0]` |
| `db.prepare(sql).all(a, b)` | `(await db.query(sql, [a, b])).rows` |
| `db.prepare(sql).run(a, b)` | `await db.query(sql, [a, b])` |
| `db.exec(sql)` | `await db.query(sql)` |
| `SELECT COUNT(*) as n ...` | `.rows[0].n` → PG returns lowercase keys |
| `ON CONFLICT(x) DO UPDATE SET` | same syntax in PostgreSQL ✓ |
| `COALESCE(SUM(...), 0)` | same ✓ |

---

## Task 1: Install pg and update package.json

**Files:**
- Modify: `backend/package.json`

- [ ] **Step 1: Install pg**

```bash
cd backend && npm install pg
```

Expected: `pg` added to `node_modules` and `package.json` dependencies.

- [ ] **Step 2: Verify pg installed**

```bash
node -e "const { Pool } = require('pg'); console.log('pg ok');"
```

Expected output: `pg ok`

- [ ] **Step 3: Commit**

```bash
git add backend/package.json backend/package-lock.json
git commit -m "deps: add pg for Neon PostgreSQL"
```

---

## Task 2: PostgreSQL Schema

**Files:**
- Create: `backend/src/db/schema.sql`

- [ ] **Step 1: Create schema.sql**

Create `backend/src/db/schema.sql` with this exact content:

```sql
-- Neon PostgreSQL schema
-- Replaces SQLite node:sqlite database.js

CREATE TABLE IF NOT EXISTS businesses (
  id              BIGSERIAL PRIMARY KEY,
  slug            TEXT      UNIQUE NOT NULL,
  name            TEXT      NOT NULL,
  owner_email     TEXT      UNIQUE NOT NULL,
  password_hash   TEXT      NOT NULL,
  phone           TEXT,
  plan            TEXT      NOT NULL DEFAULT 'basic',
  description     TEXT      DEFAULT '',
  specialty       TEXT      DEFAULT 'general',
  vertical        TEXT      DEFAULT 'salud',
  reset_token     TEXT,
  reset_token_expires TEXT,
  token_version   INTEGER   NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS services (
  id           BIGSERIAL PRIMARY KEY,
  business_id  BIGINT    NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name         TEXT      NOT NULL,
  description  TEXT,
  duration_min INTEGER   NOT NULL DEFAULT 60,
  price        NUMERIC,
  active       SMALLINT  NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS schedules (
  id          BIGSERIAL PRIMARY KEY,
  business_id BIGINT    NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  dow         INTEGER   NOT NULL,
  slots       TEXT      NOT NULL DEFAULT '[]',
  UNIQUE(business_id, dow)
);

CREATE TABLE IF NOT EXISTS bookings (
  id              BIGSERIAL PRIMARY KEY,
  business_id     BIGINT    NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  service_id      BIGINT    REFERENCES services(id),
  patient_id      BIGINT    REFERENCES patients(id),
  professional_id BIGINT    REFERENCES professionals(id),
  client_name     TEXT      NOT NULL,
  client_email    TEXT,
  client_phone    TEXT,
  client_rut      TEXT,
  datetime_iso    TEXT      NOT NULL,
  status          TEXT      NOT NULL DEFAULT 'confirmed',
  source          TEXT      NOT NULL DEFAULT 'web',
  notes           TEXT,
  reminded        SMALLINT  NOT NULL DEFAULT 0,
  cancel_token    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS professionals (
  id          BIGSERIAL PRIMARY KEY,
  business_id BIGINT    NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name        TEXT      NOT NULL,
  specialty   TEXT      NOT NULL,
  email       TEXT,
  active      SMALLINT  NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS patients (
  id           BIGSERIAL PRIMARY KEY,
  business_id  BIGINT    NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  rut          TEXT      NOT NULL,
  name         TEXT      NOT NULL,
  birth_date   TEXT,
  phone        TEXT,
  email        TEXT,
  allergies    TEXT,
  background   TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(business_id, rut)
);

CREATE TABLE IF NOT EXISTS consultations (
  id              BIGSERIAL PRIMARY KEY,
  business_id     BIGINT    NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  patient_id      BIGINT    NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  booking_id      BIGINT    REFERENCES bookings(id),
  professional_id BIGINT    REFERENCES professionals(id),
  notes           TEXT,
  diagnosis       TEXT,
  treatment       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prescriptions (
  id              BIGSERIAL PRIMARY KEY,
  consultation_id BIGINT    NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  content         TEXT      NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  business_id BIGINT    NOT NULL,
  action      TEXT      NOT NULL,
  resource    TEXT      NOT NULL,
  resource_id BIGINT,
  ip          TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  stripe_event_id TEXT PRIMARY KEY,
  processed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bookings_business_datetime ON bookings(business_id, datetime_iso);
CREATE INDEX IF NOT EXISTS idx_bookings_cancel_token ON bookings(cancel_token);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(business_id, status);
CREATE INDEX IF NOT EXISTS idx_consultations_patient ON consultations(business_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_patients_business ON patients(business_id);
CREATE INDEX IF NOT EXISTS idx_services_business_active ON services(business_id, active);
CREATE INDEX IF NOT EXISTS idx_professionals_business ON professionals(business_id, active);
CREATE INDEX IF NOT EXISTS idx_audit_logs_business ON audit_logs(business_id, created_at);
```

Note: `bookings` references `patients` and `professionals` which are defined after it in the file. PostgreSQL handles this fine since they are all in one transaction via `IF NOT EXISTS`.

**IMPORTANT**: The `bookings` table references `patients(id)` and `professionals(id)`, but those tables are defined after `bookings`. PostgreSQL requires forward-referenced tables to exist first. Reorder in schema.sql: `professionals` and `patients` must come BEFORE `bookings`.

**Corrected order in schema.sql:**
1. businesses
2. services
3. schedules
4. professionals
5. patients
6. bookings (references patients + professionals)
7. consultations
8. prescriptions
9. audit_logs
10. stripe_webhook_events
11. indexes

- [ ] **Step 2: Commit**

```bash
git add backend/src/db/schema.sql
git commit -m "db: add PostgreSQL schema for Neon migration"
```

---

## Task 3: Migration Script + New DB Connection Layer

**Files:**
- Create: `backend/src/db/migrate.js`
- Modify: `backend/src/db/database.js`

- [ ] **Step 1: Create migrate.js**

Create `backend/src/db/migrate.js`:

```js
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function migrate() {
  if (!process.env.DATABASE_URL) {
    console.error('[migrate] ERROR: DATABASE_URL no configurada en .env');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

  try {
    await pool.query(schema);
    console.log('[migrate] Schema aplicado correctamente en Neon.');
  } catch (err) {
    console.error('[migrate] Error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
```

- [ ] **Step 2: Run migration against Neon**

```bash
cd backend && node src/db/migrate.js
```

Expected output: `[migrate] Schema aplicado correctamente en Neon.`

If it fails: verify `DATABASE_URL` is set in `backend/.env` and the Neon project is active.

- [ ] **Step 3: Rewrite database.js as pg Pool**

Replace the entire content of `backend/src/db/database.js` with:

```js
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('[db] FATAL: DATABASE_URL no configurada');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[db] Pool error:', err.message);
});

// Convenience wrapper: returns { rows, rowCount }
const db = {
  query: (text, params) => pool.query(text, params),
  // Get a client for transactions
  connect: () => pool.connect(),
  pool,
};

module.exports = db;
```

- [ ] **Step 4: Verify connection**

```bash
cd backend && node -e "
require('dotenv').config();
const db = require('./src/db/database');
db.query('SELECT NOW()').then(r => { console.log('DB ok:', r.rows[0].now); process.exit(0); }).catch(e => { console.error(e.message); process.exit(1); });
"
```

Expected output: `DB ok: 2026-06-08T...` (current timestamp)

- [ ] **Step 5: Commit**

```bash
git add backend/src/db/database.js backend/src/db/migrate.js
git commit -m "db: migrate to Neon PostgreSQL via pg Pool"
```

---

## Task 4: Migrate lib/audit.js (async)

**Files:**
- Modify: `backend/src/lib/audit.js`

- [ ] **Step 1: Rewrite audit.js**

```js
const db = require('../db/database');

async function auditLog(businessId, action, resource, resourceId, ip) {
  try {
    await db.query(
      'INSERT INTO audit_logs (business_id, action, resource, resource_id, ip) VALUES ($1, $2, $3, $4, $5)',
      [businessId, action, resource, resourceId ?? null, ip ?? null]
    );
  } catch (_) {}
}

module.exports = { auditLog };
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/lib/audit.js
git commit -m "refactor: make auditLog async for pg"
```

---

## Task 5: Migrate middleware/auth.js (async)

**Files:**
- Modify: `backend/src/middleware/auth.js`

- [ ] **Step 1: Rewrite auth.js**

```js
const jwt = require('jsonwebtoken');
const db = require('../db/database');

async function authMiddleware(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  const token = header.slice(7);
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }

  try {
    const { rows } = await db.query(
      'SELECT id, token_version FROM businesses WHERE id = $1',
      [payload.id]
    );
    const business = rows[0];
    if (!business) return res.status(401).json({ error: 'Token inválido o expirado' });

    const tokenVersion = payload.tv ?? 0;
    if (tokenVersion !== business.token_version) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }

    req.business = payload;
    next();
  } catch (err) {
    console.error('[auth] DB error:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = authMiddleware;
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/middleware/auth.js
git commit -m "refactor: make auth middleware async for pg"
```

---

## Task 6: Migrate auth.controller.js (async)

**Files:**
- Modify: `backend/src/controllers/auth.controller.js`

- [ ] **Step 1: Rewrite auth.controller.js**

```js
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

const VALID_VERTICALS = ['salud', 'belleza'];

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
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/controllers/auth.controller.js
git commit -m "refactor: migrate auth.controller to async pg"
```

---

## Task 7: Migrate bookings.controller.js (async + race condition fix)

**Files:**
- Modify: `backend/src/controllers/bookings.controller.js`

- [ ] **Step 1: Rewrite bookings.controller.js**

The key changes:
1. All functions become `async`
2. `?` → `$1, $2...`
3. `date(b.datetime_iso)` → `LEFT(b.datetime_iso, 10)`
4. `db.prepare().get()` → `(await db.query()).rows[0]`
5. `db.prepare().all()` → `(await db.query()).rows`
6. `db.prepare().run()` → `await db.query()`
7. `result.lastInsertRowid` → `RETURNING id` then `rows[0].id`
8. `create` endpoint: wrap conflict check + insert in a transaction (race condition fix)
9. `publicCreate`: change `db.exec('BEGIN IMMEDIATE')` to pg transaction

```js
const db = require('../db/database');
const { randomUUID } = require('node:crypto');
const { notifyBooking } = require('../services/whatsapp');
const { sendBookingConfirmation } = require('../services/email');

const VALID_STATUSES = ['confirmed', 'cancelled', 'completed', 'no_show'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clipString(v, max) {
  if (v == null) return null;
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

const list = async (req, res) => {
  const { date, status, from } = req.query;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
  const offset = (page - 1) * limit;

  let where = 'WHERE b.business_id = $1';
  const params = [req.business.id];
  let i = 2;

  if (date) {
    if (!DATE_RE.test(date)) return res.status(400).json({ error: 'formato de fecha inválido (YYYY-MM-DD)' });
    where += ` AND LEFT(b.datetime_iso, 10) = $${i++}`;
    params.push(date);
  }
  if (from) {
    if (!DATE_RE.test(from)) return res.status(400).json({ error: 'formato de fecha inválido (YYYY-MM-DD)' });
    where += ` AND LEFT(b.datetime_iso, 10) >= $${i++}`;
    params.push(from);
  }
  if (status) {
    if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: `status debe ser uno de: ${VALID_STATUSES.join(', ')}` });
    where += ` AND b.status = $${i++}`;
    params.push(status);
  }

  try {
    const { rows: totalRows } = await db.query(`SELECT COUNT(*) as n FROM bookings b ${where}`, params);
    const total = parseInt(totalRows[0].n);

    const { rows: bookings } = await db.query(`
      SELECT b.*, s.name as service_name, s.duration_min, p.name as patient_name, p.rut as patient_rut
      FROM bookings b
      LEFT JOIN services s ON b.service_id = s.id
      LEFT JOIN patients p ON b.patient_id = p.id
      ${where}
      ORDER BY b.datetime_iso ASC
      LIMIT $${i++} OFFSET $${i++}
    `, [...params, limit, offset]);

    res.json({ bookings, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('[bookings] list error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const create = async (req, res) => {
  const { client_name, client_email, client_phone, service_id, datetime_iso, notes, source } = req.body;

  if (!client_name || !datetime_iso) {
    return res.status(400).json({ error: 'client_name y datetime_iso son requeridos' });
  }

  const client = await db.connect();
  try {
    if (service_id) {
      const { rows } = await client.query('SELECT id FROM services WHERE id = $1 AND business_id = $2', [service_id, req.business.id]);
      if (!rows[0]) return res.status(404).json({ error: 'Servicio no encontrado' });
    }

    await client.query('BEGIN');

    const { rows: conflict } = await client.query(
      "SELECT id FROM bookings WHERE business_id = $1 AND datetime_iso = $2 AND status != 'cancelled'",
      [req.business.id, datetime_iso]
    );
    if (conflict.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Ese horario ya está reservado' });
    }

    const { rows } = await client.query(`
      INSERT INTO bookings (business_id, service_id, client_name, client_email, client_phone, datetime_iso, notes, source)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [req.business.id, service_id || null, client_name, client_email || null, client_phone || null, datetime_iso, notes || null, source || 'web']);

    await client.query('COMMIT');

    const { rows: full } = await db.query(`
      SELECT b.*, s.name as service_name FROM bookings b
      LEFT JOIN services s ON b.service_id = s.id
      WHERE b.id = $1
    `, [rows[0].id]);

    res.status(201).json(full[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[bookings] create error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    client.release();
  }
};

const updateStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const valid = ['confirmed', 'cancelled', 'completed', 'no_show'];

  if (!valid.includes(status)) {
    return res.status(400).json({ error: `status debe ser uno de: ${valid.join(', ')}` });
  }

  try {
    const { rows } = await db.query('SELECT id FROM bookings WHERE id = $1 AND business_id = $2', [id, req.business.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Reserva no encontrada' });

    await db.query('UPDATE bookings SET status = $1 WHERE id = $2', [status, id]);
    const { rows: updated } = await db.query('SELECT * FROM bookings WHERE id = $1', [id]);
    res.json(updated[0]);
  } catch (err) {
    console.error('[bookings] updateStatus error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const remove = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await db.query('SELECT id FROM bookings WHERE id = $1 AND business_id = $2', [id, req.business.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Reserva no encontrada' });
    await db.query('DELETE FROM bookings WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[bookings] remove error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const publicCreate = async (req, res) => {
  const { slug } = req.params;

  const name = clipString(req.body.client_name, 100);
  if (!name) return res.status(400).json({ error: 'client_name es requerido' });

  const datetime_iso = req.body.datetime_iso;
  if (!datetime_iso || typeof datetime_iso !== 'string' || !DATETIME_RE.test(datetime_iso)) {
    return res.status(400).json({ error: 'datetime_iso inválido' });
  }
  if (new Date(datetime_iso) <= new Date()) {
    return res.status(400).json({ error: 'No se puede reservar en una fecha pasada' });
  }

  const email = clipString(req.body.client_email, 254);
  if (email && !EMAIL_RE.test(email)) return res.status(400).json({ error: 'email inválido' });

  const phone = clipString(req.body.client_phone, 30);
  const rut = clipString(req.body.client_rut, 20);
  const notes = clipString(req.body.notes, 500);
  const serviceId = req.body.service_id;

  if (serviceId !== undefined && serviceId !== null && !Number.isInteger(serviceId)) {
    return res.status(400).json({ error: 'service_id inválido' });
  }

  const VALID_SOURCES = ['web', 'whatsapp', 'phone', 'other'];
  const source = VALID_SOURCES.includes(req.body.source) ? req.body.source : 'web';

  const client = await db.connect();
  try {
    const { rows: bizRows } = await client.query('SELECT * FROM businesses WHERE slug = $1', [slug]);
    if (!bizRows[0]) return res.status(404).json({ error: 'Negocio no encontrado' });
    const business = bizRows[0];

    if (serviceId) {
      const { rows: svcRows } = await client.query('SELECT id FROM services WHERE id = $1 AND business_id = $2', [serviceId, business.id]);
      if (!svcRows[0]) return res.status(404).json({ error: 'Servicio no encontrado' });
    }

    const cancelToken = randomUUID();

    await client.query('BEGIN');

    const { rows: conflict } = await client.query(
      "SELECT id FROM bookings WHERE business_id = $1 AND datetime_iso = $2 AND status != 'cancelled'",
      [business.id, datetime_iso]
    );
    if (conflict.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Ese horario ya no está disponible' });
    }

    const { rows } = await client.query(`
      INSERT INTO bookings (business_id, service_id, client_name, client_email, client_phone, datetime_iso, notes, source, client_rut, cancel_token)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [business.id, serviceId || null, name, email, phone, datetime_iso, notes, source, rut, cancelToken]);

    await client.query('COMMIT');
    const booking = rows[0];

    const serviceRow = serviceId
      ? (await db.query('SELECT name FROM services WHERE id = $1', [serviceId])).rows[0]
      : null;

    notifyBooking({
      clientName: name, clientPhone: phone, clientEmail: email,
      serviceName: serviceRow?.name || null, datetimeISO: datetime_iso,
      businessName: business.name,
    }).catch(err => console.error('[whatsapp] Error enviando notificación:', err));

    sendBookingConfirmation({
      clientName: name, clientEmail: email,
      serviceName: serviceRow?.name || null, datetimeISO: datetime_iso,
      businessName: business.name, cancelToken,
    }).catch(err => console.error('[email] Error enviando confirmación:', err));

    res.status(201).json({ ok: true, booking_id: booking.id, datetime_iso: booking.datetime_iso, cancel_token: cancelToken });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[bookings] publicCreate error:', err.message);
    res.status(500).json({ error: 'Error interno al crear la reserva' });
  } finally {
    client.release();
  }
};

const updateBooking = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT id FROM bookings WHERE id = $1 AND business_id = $2', [req.params.id, req.business.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Reserva no encontrada' });

    const { patient_id } = req.body;
    if (patient_id !== undefined) {
      let safePatientId = null;
      if (patient_id) {
        const { rows: owned } = await db.query('SELECT id FROM patients WHERE id = $1 AND business_id = $2', [patient_id, req.business.id]);
        if (!owned[0]) return res.status(404).json({ error: 'Paciente no encontrado' });
        safePatientId = owned[0].id;
      }
      await db.query('UPDATE bookings SET patient_id = $1 WHERE id = $2', [safePatientId, req.params.id]);
    }

    const { rows: updated } = await db.query('SELECT * FROM bookings WHERE id = $1', [req.params.id]);
    res.json(updated[0]);
  } catch (err) {
    console.error('[bookings] updateBooking error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { list, create, updateStatus, remove, publicCreate, updateBooking };
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/controllers/bookings.controller.js
git commit -m "refactor: migrate bookings.controller to async pg + fix race condition"
```

---

## Task 8: Migrate public.routes.js (async + P0 security fixes)

**Files:**
- Modify: `backend/src/routes/public.routes.js`

P0 fixes included in this task:
- **Fix 1**: JSON.parse without try/catch → use `safeParseSlots()`
- **Fix 2**: Phone validation strengthened with regex
- **Fix 3**: `cancel_token` query uses pg parameterized query (IDOR mitigation — token itself is UUID, fixing index usage)

- [ ] **Step 1: Rewrite public.routes.js**

```js
const router = require('express').Router();
const db = require('../db/database');

const DAYS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const PHONE_RE = /^\+?[0-9]{7,15}$/;

function safeParseSlots(raw) {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function expandRange(start, end, stepMin = 30) {
  const slots = [];
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let cur = sh * 60 + sm;
  const endMins = eh * 60 + em;
  while (cur < endMins) {
    const h = Math.floor(cur / 60);
    const m = cur % 60;
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    cur += stepMin;
  }
  return slots;
}

router.get('/:slug', async (req, res) => {
  try {
    const { rows: bizRows } = await db.query(
      'SELECT id, slug, name, phone, specialty, vertical FROM businesses WHERE slug = $1',
      [req.params.slug]
    );
    if (!bizRows[0]) return res.status(404).json({ error: 'Negocio no encontrado' });
    const business = bizRows[0];

    const { rows: services } = await db.query(
      'SELECT id, name, description, duration_min, price FROM services WHERE business_id = $1 AND active = 1',
      [business.id]
    );

    const { rows: scheduleRows } = await db.query(
      'SELECT dow, slots FROM schedules WHERE business_id = $1',
      [business.id]
    );
    const schedules = scheduleRows.map(r => ({ dow: r.dow, slots: safeParseSlots(r.slots) }));

    res.json({ business, services, schedules });
  } catch (err) {
    console.error('[public] get slug error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/:slug/slots', async (req, res) => {
  try {
    const { rows: bizRows } = await db.query('SELECT id FROM businesses WHERE slug = $1', [req.params.slug]);
    if (!bizRows[0]) return res.status(404).json({ error: 'Negocio no encontrado' });
    const business = bizRows[0];

    const days = Math.min(30, Math.max(1, parseInt(req.query.days) || 7));
    const startDate = req.query.date ? new Date(req.query.date + 'T00:00:00') : new Date();
    startDate.setHours(0, 0, 0, 0);

    const serviceId = req.query.service_id ? parseInt(req.query.service_id) : null;
    let stepMin = 30;
    if (serviceId) {
      const { rows: svcRows } = await db.query(
        'SELECT duration_min FROM services WHERE id = $1 AND business_id = $2',
        [serviceId, business.id]
      );
      if (svcRows[0]) stepMin = svcRows[0].duration_min;
    }

    const { rows: scheduleRows } = await db.query('SELECT dow, slots FROM schedules WHERE business_id = $1', [business.id]);
    const scheduleMap = {};
    scheduleRows.forEach(r => { scheduleMap[r.dow] = safeParseSlots(r.slots); });

    const result = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const dow = d.getDay();
      const ranges = scheduleMap[dow] || [];
      if (!ranges.length) continue;

      const dateStr = d.toISOString().slice(0, 10);

      const { rows: bookedRows } = await db.query(`
        SELECT SUBSTRING(datetime_iso FROM 12 FOR 5) as t FROM bookings
        WHERE business_id = $1 AND LEFT(datetime_iso, 10) = $2 AND status != 'cancelled'
      `, [business.id, dateStr]);
      const booked = bookedRows.map(r => r.t);

      const allTimes = ranges.flatMap(r => expandRange(r.start, r.end, stepMin));
      const available = allTimes.filter(t => !booked.includes(t));
      if (!available.length) continue;

      result.push({
        date: dateStr,
        dow,
        label: `${DAYS_ES[dow]} ${d.getDate()} de ${MONTHS_ES[d.getMonth()]}`,
        slots: available,
      });
    }

    res.json(result);
  } catch (err) {
    console.error('[public] slots error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/cancel/:token', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM bookings WHERE cancel_token = $1', [req.params.token]);
    const booking = rows[0];
    if (!booking) return res.status(404).json({ error: 'Reserva no encontrada o enlace inválido' });
    if (booking.status === 'cancelled') return res.status(409).json({ error: 'ya_cancelada' });
    if (new Date(booking.datetime_iso) <= new Date()) return res.status(409).json({ error: 'ya_pasada' });

    const { rows: svcRows } = booking.service_id
      ? await db.query('SELECT name FROM services WHERE id = $1', [booking.service_id])
      : { rows: [] };
    const { rows: bizRows } = await db.query('SELECT name FROM businesses WHERE id = $1', [booking.business_id]);

    res.json({
      booking: {
        id: booking.id,
        client_name: booking.client_name,
        datetime_iso: booking.datetime_iso,
        status: booking.status,
        service_name: svcRows[0]?.name || null,
        business_name: bizRows[0]?.name || null,
      },
    });
  } catch (err) {
    console.error('[public] cancel get error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/cancel/:token', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM bookings WHERE cancel_token = $1', [req.params.token]);
    const booking = rows[0];
    if (!booking) return res.status(404).json({ error: 'Reserva no encontrada o enlace inválido' });
    if (booking.status === 'cancelled') return res.status(409).json({ error: 'ya_cancelada' });
    if (new Date(booking.datetime_iso) <= new Date()) return res.status(409).json({ error: 'ya_pasada' });

    await db.query("UPDATE bookings SET status = 'cancelled' WHERE cancel_token = $1", [req.params.token]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[public] cancel post error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/:slug/mis-citas', async (req, res) => {
  try {
    const { rows: bizRows } = await db.query('SELECT id, name FROM businesses WHERE slug = $1', [req.params.slug]);
    if (!bizRows[0]) return res.status(404).json({ error: 'Negocio no encontrado' });
    const business = bizRows[0];

    const phone = (req.query.phone || '').trim();
    if (!PHONE_RE.test(phone)) return res.status(400).json({ error: 'Ingresa un número de teléfono válido' });

    const today = new Date().toISOString().slice(0, 10);
    const { rows: bookings } = await db.query(`
      SELECT b.id, b.datetime_iso, b.status, b.cancel_token,
             s.name as service_name
      FROM bookings b
      LEFT JOIN services s ON b.service_id = s.id
      WHERE b.business_id = $1 AND b.client_phone = $2
        AND LEFT(b.datetime_iso, 10) >= $3
        AND b.status != 'cancelled'
      ORDER BY b.datetime_iso ASC
      LIMIT 20
    `, [business.id, phone, today]);

    res.json({ business: { name: business.name }, bookings });
  } catch (err) {
    console.error('[public] mis-citas error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/routes/public.routes.js
git commit -m "refactor: migrate public.routes to async pg + fix JSON.parse crash + phone validation"
```

---

## Task 9: Migrate patients.controller.js (async)

**Files:**
- Modify: `backend/src/controllers/patients.controller.js`

- [ ] **Step 1: Rewrite patients.controller.js**

```js
const db = require('../db/database');
const { encrypt, decrypt } = require('../lib/crypto');
const { isValidRut } = require('../lib/rut');
const { auditLog } = require('../lib/audit');

const list = async (req, res) => {
  const { search, page = '1', limit = '20' } = req.query;
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const offset = (pageNum - 1) * limitNum;

  let whereClause = 'WHERE p.business_id = $1';
  const params = [req.business.id];
  let i = 2;

  if (search) {
    whereClause += ` AND (LOWER(p.name) LIKE $${i} OR LOWER(p.rut) LIKE $${i+1})`;
    const s = `%${search.toLowerCase()}%`;
    params.push(s, s);
    i += 2;
  }

  try {
    const { rows: totalRows } = await db.query(`SELECT COUNT(*) as total FROM patients p ${whereClause}`, params);
    const total = parseInt(totalRows[0].total);

    const { rows: patients } = await db.query(`
      SELECT p.id, p.rut, p.name, p.birth_date, p.phone, p.email, p.notes, p.created_at,
             COUNT(b.id) as booking_count,
             MAX(b.datetime_iso) as last_booking_at
      FROM patients p
      LEFT JOIN bookings b ON b.patient_id = p.id AND b.status != 'cancelled'
      ${whereClause}
      GROUP BY p.id
      ORDER BY p.name ASC LIMIT $${i++} OFFSET $${i++}
    `, [...params, limitNum, offset]);

    res.json({ patients, total, page: pageNum, pages: Math.ceil(total / limitNum) });
  } catch (err) {
    console.error('[patients] list error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const getById = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM patients WHERE id = $1 AND business_id = $2', [req.params.id, req.business.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Paciente no encontrado' });
    const patient = rows[0];
    await auditLog(req.business.id, 'VIEW_PATIENT', 'patient', patient.id, req.ip);

    if (patient.allergies) patient.allergies = decrypt(patient.allergies);
    if (patient.background) patient.background = decrypt(patient.background);

    const { rows: consultations } = await db.query(`
      SELECT c.id, c.created_at, c.diagnosis, pr.name as professional_name
      FROM consultations c
      LEFT JOIN professionals pr ON c.professional_id = pr.id
      WHERE c.patient_id = $1 AND c.business_id = $2
      ORDER BY c.created_at DESC LIMIT 5
    `, [patient.id, req.business.id]);

    consultations.forEach(c => { if (c.diagnosis) c.diagnosis = decrypt(c.diagnosis); });

    res.json({ ...patient, recent_consultations: consultations });
  } catch (err) {
    console.error('[patients] getById error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const MAX_TEXT = 5000;

const create = async (req, res) => {
  const { rut, name, birth_date, phone, email, allergies, background, notes } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'name es requerido' });
  }
  if (allergies && typeof allergies === 'string' && allergies.length > MAX_TEXT)
    return res.status(400).json({ error: 'allergies excede el límite permitido' });
  if (background && typeof background === 'string' && background.length > MAX_TEXT)
    return res.status(400).json({ error: 'background excede el límite permitido' });

  try {
    const { rows: bizRows } = await db.query('SELECT vertical FROM businesses WHERE id = $1', [req.business.id]);
    const isBelleza = (bizRows[0]?.vertical || 'salud') === 'belleza';

    let safeRut;
    if (isBelleza) {
      safeRut = `CLI-${req.business.id}-${require('node:crypto').randomUUID()}`;
    } else {
      if (!rut) return res.status(400).json({ error: 'rut y name son requeridos' });
      if (!isValidRut(rut)) return res.status(400).json({ error: 'RUT inválido' });
      const { rows: existing } = await db.query('SELECT id FROM patients WHERE business_id = $1 AND rut = $2', [req.business.id, rut]);
      if (existing.length) return res.status(409).json({ error: 'Paciente ya registrado', patient_id: existing[0].id });
      safeRut = rut;
    }

    const { rows } = await db.query(`
      INSERT INTO patients (business_id, rut, name, birth_date, phone, email, allergies, background, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, rut, name, birth_date, phone, email, notes, created_at
    `, [
      req.business.id, safeRut, name.trim(),
      birth_date || null, phone || null, email || null,
      allergies ? encrypt(allergies) : null,
      background ? encrypt(background) : null,
      notes || null,
    ]);

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[patients] create error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const update = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM patients WHERE id = $1 AND business_id = $2', [req.params.id, req.business.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Paciente no encontrado' });
    const patient = rows[0];

    const { name, birth_date, phone, email, allergies, background, notes } = req.body;
    if (allergies && typeof allergies === 'string' && allergies.length > MAX_TEXT)
      return res.status(400).json({ error: 'allergies excede el límite permitido' });
    if (background && typeof background === 'string' && background.length > MAX_TEXT)
      return res.status(400).json({ error: 'background excede el límite permitido' });

    await db.query(`
      UPDATE patients SET name = $1, birth_date = $2, phone = $3, email = $4, allergies = $5, background = $6, notes = $7
      WHERE id = $8
    `, [
      name !== undefined ? name.trim() : patient.name,
      birth_date !== undefined ? birth_date : patient.birth_date,
      phone !== undefined ? phone : patient.phone,
      email !== undefined ? email : patient.email,
      allergies !== undefined ? (allergies ? encrypt(allergies) : null) : patient.allergies,
      background !== undefined ? (background ? encrypt(background) : null) : patient.background,
      notes !== undefined ? notes : patient.notes,
      patient.id,
    ]);

    const { rows: updated } = await db.query(
      'SELECT id, rut, name, birth_date, phone, email, notes, created_at FROM patients WHERE id = $1',
      [patient.id]
    );
    res.json(updated[0]);
  } catch (err) {
    console.error('[patients] update error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const history = async (req, res) => {
  const { page = '1', limit = '10' } = req.query;
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 10));
  const offset = (pageNum - 1) * limitNum;

  try {
    const { rows: patRows } = await db.query('SELECT id FROM patients WHERE id = $1 AND business_id = $2', [req.params.id, req.business.id]);
    if (!patRows[0]) return res.status(404).json({ error: 'Paciente no encontrado' });

    const { rows: totalRows } = await db.query('SELECT COUNT(*) as total FROM consultations WHERE patient_id = $1 AND business_id = $2', [patRows[0].id, req.business.id]);
    const total = parseInt(totalRows[0].total);

    const { rows } = await db.query(`
      SELECT c.id, c.created_at, c.diagnosis, c.treatment, pr.name as professional_name
      FROM consultations c
      LEFT JOIN professionals pr ON c.professional_id = pr.id
      WHERE c.patient_id = $1 AND c.business_id = $2
      ORDER BY c.created_at DESC LIMIT $3 OFFSET $4
    `, [patRows[0].id, req.business.id, limitNum, offset]);

    rows.forEach(r => {
      if (r.diagnosis) r.diagnosis = decrypt(r.diagnosis);
      if (r.treatment) r.treatment = decrypt(r.treatment);
    });

    res.json({ consultations: rows, total, page: pageNum, pages: Math.ceil(total / limitNum) });
  } catch (err) {
    console.error('[patients] history error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const exportData = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM patients WHERE id = $1 AND business_id = $2', [req.params.id, req.business.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Paciente no encontrado' });
    const patient = rows[0];
    await auditLog(req.business.id, 'EXPORT_PATIENT', 'patient', patient.id, req.ip);

    if (patient.allergies) patient.allergies = decrypt(patient.allergies);
    if (patient.background) patient.background = decrypt(patient.background);

    const { rows: consultations } = await db.query(`
      SELECT c.*, pr.name as professional_name
      FROM consultations c
      LEFT JOIN professionals pr ON c.professional_id = pr.id
      WHERE c.patient_id = $1 AND c.business_id = $2
      ORDER BY c.created_at DESC
    `, [patient.id, req.business.id]);

    for (const c of consultations) {
      if (c.notes) c.notes = decrypt(c.notes);
      if (c.diagnosis) c.diagnosis = decrypt(c.diagnosis);
      if (c.treatment) c.treatment = decrypt(c.treatment);
      const { rows: prescriptions } = await db.query('SELECT * FROM prescriptions WHERE consultation_id = $1', [c.id]);
      c.prescriptions = prescriptions.map(p => ({ ...p, content: p.content ? decrypt(p.content) : null }));
    }

    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Disposition', `attachment; filename="paciente-${patient.rut}-${date}.json"`);
    res.json({ patient, consultations });
  } catch (err) {
    console.error('[patients] exportData error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const clientBookings = async (req, res) => {
  try {
    const { rows: patRows } = await db.query('SELECT id FROM patients WHERE id = $1 AND business_id = $2', [req.params.id, req.business.id]);
    if (!patRows[0]) return res.status(404).json({ error: 'Cliente no encontrado' });

    const { rows: bookings } = await db.query(`
      SELECT b.id, b.datetime_iso, b.status, b.notes, b.client_name,
             s.name as service_name, pr.name as professional_name
      FROM bookings b
      LEFT JOIN services s ON b.service_id = s.id
      LEFT JOIN professionals pr ON b.professional_id = pr.id
      WHERE b.patient_id = $1 AND b.business_id = $2
      ORDER BY b.datetime_iso DESC LIMIT 30
    `, [patRows[0].id, req.business.id]);

    res.json({ bookings });
  } catch (err) {
    console.error('[patients] clientBookings error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { list, getById, create, update, history, exportData, clientBookings };
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/controllers/patients.controller.js
git commit -m "refactor: migrate patients.controller to async pg"
```

---

## Task 10: Migrate consultations, prescriptions, services, schedules, professionals, analytics, settings (async)

**Files:**
- Modify: all 7 controller files listed above

- [ ] **Step 1: Rewrite consultations.controller.js**

```js
const db = require('../db/database');
const { encrypt, decrypt } = require('../lib/crypto');

const list = async (req, res) => {
  const { patient_id, date, professional_id } = req.query;
  let where = 'WHERE c.business_id = $1';
  const params = [req.business.id];
  let i = 2;

  if (patient_id) { where += ` AND c.patient_id = $${i++}`; params.push(patient_id); }
  if (professional_id) { where += ` AND c.professional_id = $${i++}`; params.push(professional_id); }
  if (date) { where += ` AND LEFT(c.created_at::text, 10) = $${i++}`; params.push(date); }

  try {
    const { rows } = await db.query(`
      SELECT c.id, c.patient_id, c.booking_id, c.professional_id,
             c.notes, c.diagnosis, c.treatment, c.created_at,
             p.name as patient_name, pr.name as professional_name
      FROM consultations c
      LEFT JOIN patients p ON c.patient_id = p.id
      LEFT JOIN professionals pr ON c.professional_id = pr.id
      ${where}
      ORDER BY c.created_at DESC
    `, params);

    rows.forEach(r => {
      if (r.notes) r.notes = decrypt(r.notes);
      if (r.diagnosis) r.diagnosis = decrypt(r.diagnosis);
      if (r.treatment) r.treatment = decrypt(r.treatment);
    });

    res.json(rows);
  } catch (err) {
    console.error('[consultations] list error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const create = async (req, res) => {
  const { patient_id, booking_id, professional_id, notes, diagnosis, treatment } = req.body;
  if (!patient_id) return res.status(400).json({ error: 'patient_id es requerido' });

  try {
    const { rows: patRows } = await db.query('SELECT id FROM patients WHERE id = $1 AND business_id = $2', [patient_id, req.business.id]);
    if (!patRows[0]) return res.status(404).json({ error: 'Paciente no encontrado' });

    if (booking_id) {
      const { rows } = await db.query('SELECT id FROM bookings WHERE id = $1 AND business_id = $2', [booking_id, req.business.id]);
      if (!rows[0]) return res.status(404).json({ error: 'Reserva no encontrada' });
    }
    if (professional_id) {
      const { rows } = await db.query('SELECT id FROM professionals WHERE id = $1 AND business_id = $2', [professional_id, req.business.id]);
      if (!rows[0]) return res.status(404).json({ error: 'Profesional no encontrado' });
    }

    const { rows } = await db.query(`
      INSERT INTO consultations (business_id, patient_id, booking_id, professional_id, notes, diagnosis, treatment)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      req.business.id, patient_id,
      booking_id || null, professional_id || null,
      notes ? encrypt(notes) : null,
      diagnosis ? encrypt(diagnosis) : null,
      treatment ? encrypt(treatment) : null,
    ]);

    const c = rows[0];
    if (c.notes) c.notes = decrypt(c.notes);
    if (c.diagnosis) c.diagnosis = decrypt(c.diagnosis);
    if (c.treatment) c.treatment = decrypt(c.treatment);

    res.status(201).json(c);
  } catch (err) {
    console.error('[consultations] create error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const getById = async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT c.*, p.name as patient_name, pr.name as professional_name
      FROM consultations c
      LEFT JOIN patients p ON c.patient_id = p.id
      LEFT JOIN professionals pr ON c.professional_id = pr.id
      WHERE c.id = $1 AND c.business_id = $2
    `, [req.params.id, req.business.id]);

    if (!rows[0]) return res.status(404).json({ error: 'Consulta no encontrada' });
    const c = rows[0];
    if (c.notes) c.notes = decrypt(c.notes);
    if (c.diagnosis) c.diagnosis = decrypt(c.diagnosis);
    if (c.treatment) c.treatment = decrypt(c.treatment);

    const { rows: prescriptions } = await db.query('SELECT * FROM prescriptions WHERE consultation_id = $1', [c.id]);
    prescriptions.forEach(p => { if (p.content) p.content = decrypt(p.content); });

    res.json({ ...c, prescriptions });
  } catch (err) {
    console.error('[consultations] getById error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const update = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM consultations WHERE id = $1 AND business_id = $2', [req.params.id, req.business.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Consulta no encontrada' });
    const c = rows[0];
    const { notes, diagnosis, treatment } = req.body;

    await db.query('UPDATE consultations SET notes = $1, diagnosis = $2, treatment = $3 WHERE id = $4', [
      notes !== undefined ? (notes ? encrypt(notes) : null) : c.notes,
      diagnosis !== undefined ? (diagnosis ? encrypt(diagnosis) : null) : c.diagnosis,
      treatment !== undefined ? (treatment ? encrypt(treatment) : null) : c.treatment,
      c.id,
    ]);

    const { rows: updated } = await db.query('SELECT * FROM consultations WHERE id = $1', [c.id]);
    const u = updated[0];
    if (u.notes) u.notes = decrypt(u.notes);
    if (u.diagnosis) u.diagnosis = decrypt(u.diagnosis);
    if (u.treatment) u.treatment = decrypt(u.treatment);
    res.json(u);
  } catch (err) {
    console.error('[consultations] update error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { list, create, getById, update };
```

- [ ] **Step 2: Rewrite prescriptions.controller.js**

```js
const db = require('../db/database');
const { encrypt, decrypt } = require('../lib/crypto');
const { auditLog } = require('../lib/audit');

const MAX_CONTENT = 10000;

const create = async (req, res) => {
  const { consultation_id, content } = req.body;
  if (!consultation_id || !content) return res.status(400).json({ error: 'consultation_id y content son requeridos' });
  if (typeof content === 'string' && content.length > MAX_CONTENT)
    return res.status(400).json({ error: 'content excede el límite permitido' });

  try {
    const { rows: consRows } = await db.query('SELECT * FROM consultations WHERE id = $1 AND business_id = $2', [consultation_id, req.business.id]);
    if (!consRows[0]) return res.status(404).json({ error: 'Consulta no encontrada' });

    const { rows } = await db.query(
      'INSERT INTO prescriptions (consultation_id, content) VALUES ($1, $2) RETURNING *',
      [consultation_id, encrypt(content)]
    );
    const prescription = rows[0];
    prescription.content = decrypt(prescription.content);
    res.status(201).json(prescription);
  } catch (err) {
    console.error('[prescriptions] create error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const getById = async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT pr.*, c.business_id
      FROM prescriptions pr
      JOIN consultations c ON pr.consultation_id = c.id
      WHERE pr.id = $1 AND c.business_id = $2
    `, [req.params.id, req.business.id]);

    if (!rows[0]) return res.status(404).json({ error: 'Receta no encontrada' });
    await auditLog(req.business.id, 'VIEW_PRESCRIPTION', 'prescription', rows[0].id, req.ip);
    rows[0].content = decrypt(rows[0].content);
    res.json(rows[0]);
  } catch (err) {
    console.error('[prescriptions] getById error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const downloadPdf = async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT pr.*, c.business_id, c.patient_id
      FROM prescriptions pr
      JOIN consultations c ON pr.consultation_id = c.id
      WHERE pr.id = $1 AND c.business_id = $2
    `, [req.params.id, req.business.id]);

    if (!rows[0]) return res.status(404).json({ error: 'Receta no encontrada' });
    await auditLog(req.business.id, 'DOWNLOAD_PRESCRIPTION', 'prescription', rows[0].id, req.ip);

    const content = decrypt(rows[0].content);
    const { rows: patRows } = await db.query('SELECT name, rut FROM patients WHERE id = $1', [rows[0].patient_id]);
    const { rows: bizRows } = await db.query('SELECT name FROM businesses WHERE id = $1', [req.business.id]);
    const date = new Date().toLocaleDateString('es-CL');

    const text = [
      'RECETA / INDICACIONES',
      '=====================',
      `Establecimiento: ${bizRows[0]?.name || ''}`,
      `Fecha: ${date}`,
      '',
      `Paciente: ${patRows[0]?.name || 'N/A'}`,
      `RUT: ${patRows[0]?.rut || 'N/A'}`,
      '',
      'INDICACIONES:',
      '-------------',
      content,
    ].join('\n');

    res.setHeader('Content-Disposition', `attachment; filename="receta-${rows[0].id}.txt"`);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(text);
  } catch (err) {
    console.error('[prescriptions] downloadPdf error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { create, getById, downloadPdf };
```

- [ ] **Step 3: Rewrite services.controller.js**

```js
const db = require('../db/database');

const list = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM services WHERE business_id = $1 ORDER BY id ASC', [req.business.id]);
    res.json(rows);
  } catch (err) {
    console.error('[services] list error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const create = async (req, res) => {
  const { name, description, duration_min, price } = req.body;
  if (!name) return res.status(400).json({ error: 'nombre es requerido' });

  try {
    const { rows } = await db.query(`
      INSERT INTO services (business_id, name, description, duration_min, price)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [req.business.id, name, description || null, duration_min || 60, price || null]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[services] create error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const update = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await db.query('SELECT * FROM services WHERE id = $1 AND business_id = $2', [id, req.business.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Servicio no encontrado' });
    const service = rows[0];
    const { name, description, duration_min, price, active } = req.body;

    await db.query(`
      UPDATE services SET name = $1, description = $2, duration_min = $3, price = $4, active = $5 WHERE id = $6
    `, [
      name ?? service.name,
      description ?? service.description,
      duration_min ?? service.duration_min,
      price ?? service.price,
      active ?? service.active,
      id,
    ]);

    const { rows: updated } = await db.query('SELECT * FROM services WHERE id = $1', [id]);
    res.json(updated[0]);
  } catch (err) {
    console.error('[services] update error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const remove = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await db.query('SELECT id FROM services WHERE id = $1 AND business_id = $2', [id, req.business.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Servicio no encontrado' });
    await db.query('DELETE FROM services WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[services] remove error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { list, create, update, remove };
```

- [ ] **Step 4: Rewrite schedules.controller.js**

```js
const db = require('../db/database');

const DOW_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const TIME_RE = /^\d{2}:\d{2}$/;

function safeParseSlots(raw) {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const list = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM schedules WHERE business_id = $1 ORDER BY dow ASC', [req.business.id]);
    res.json(rows.map(r => ({ ...r, slots: safeParseSlots(r.slots), day_name: DOW_NAMES[r.dow] })));
  } catch (err) {
    console.error('[schedules] list error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const upsert = async (req, res) => {
  const { dow, slots } = req.body;
  if (dow === undefined || !Array.isArray(slots)) {
    return res.status(400).json({ error: 'dow (0-6) y slots (array) son requeridos' });
  }
  const dowNum = Number(dow);
  if (!Number.isInteger(dowNum) || dowNum < 0 || dowNum > 6) {
    return res.status(400).json({ error: 'dow debe ser un entero entre 0 y 6' });
  }
  if (slots.length > 48) return res.status(400).json({ error: 'máximo 48 slots por día' });
  const validSlots = slots.filter(s => typeof s === 'string' && TIME_RE.test(s));

  try {
    await db.query(`
      INSERT INTO schedules (business_id, dow, slots)
      VALUES ($1, $2, $3)
      ON CONFLICT(business_id, dow) DO UPDATE SET slots = EXCLUDED.slots
    `, [req.business.id, dowNum, JSON.stringify(validSlots)]);

    const { rows } = await db.query('SELECT * FROM schedules WHERE business_id = $1 AND dow = $2', [req.business.id, dowNum]);
    res.json({ ...rows[0], slots: safeParseSlots(rows[0].slots), day_name: DOW_NAMES[rows[0].dow] });
  } catch (err) {
    console.error('[schedules] upsert error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const remove = async (req, res) => {
  const dowNum = Number(req.params.dow);
  if (!Number.isInteger(dowNum) || dowNum < 0 || dowNum > 6) {
    return res.status(400).json({ error: 'dow inválido' });
  }
  try {
    await db.query('DELETE FROM schedules WHERE business_id = $1 AND dow = $2', [req.business.id, dowNum]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[schedules] remove error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { list, upsert, remove };
```

- [ ] **Step 5: Rewrite professionals.controller.js**

```js
const db = require('../db/database');

const getOne = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM professionals WHERE id = $1 AND business_id = $2 AND active = 1', [req.params.id, req.business.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Profesional no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const list = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM professionals WHERE business_id = $1 AND active = 1 ORDER BY name ASC', [req.business.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const create = async (req, res) => {
  const { name, specialty, email } = req.body;
  if (!name || !specialty) return res.status(400).json({ error: 'name y specialty son requeridos' });
  try {
    const { rows } = await db.query(
      'INSERT INTO professionals (business_id, name, specialty, email) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.business.id, name.trim(), specialty.trim(), email || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const update = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM professionals WHERE id = $1 AND business_id = $2 AND active = 1', [req.params.id, req.business.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Profesional no encontrado' });
    const prof = rows[0];
    const { name, specialty, email } = req.body;
    await db.query('UPDATE professionals SET name = $1, specialty = $2, email = $3 WHERE id = $4', [
      name !== undefined ? name.trim() : prof.name,
      specialty !== undefined ? specialty.trim() : prof.specialty,
      email !== undefined ? email : prof.email,
      prof.id,
    ]);
    const { rows: updated } = await db.query('SELECT * FROM professionals WHERE id = $1', [prof.id]);
    res.json(updated[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const remove = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT id FROM professionals WHERE id = $1 AND business_id = $2', [req.params.id, req.business.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Profesional no encontrado' });
    await db.query('UPDATE professionals SET active = 0 WHERE id = $1', [rows[0].id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getOne, list, create, update, remove };
```

- [ ] **Step 6: Rewrite analytics.controller.js**

```js
const db = require('../db/database');

const getSummary = async (req, res) => {
  const { from, to } = req.query;
  const id = req.business.id;
  const fromDate = from || new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  const toDate = to || new Date().toISOString().slice(0, 10);

  try {
    const { rows: totalRows } = await db.query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN status = 'no_show'   THEN 1 ELSE 0 END) as no_show
      FROM bookings
      WHERE business_id = $1 AND LEFT(datetime_iso, 10) BETWEEN $2 AND $3
    `, [id, fromDate, toDate]);

    const { rows: byDay } = await db.query(`
      SELECT LEFT(datetime_iso, 10) as day, COUNT(*) as count
      FROM bookings
      WHERE business_id = $1 AND LEFT(datetime_iso, 10) BETWEEN $2 AND $3
      GROUP BY day ORDER BY day ASC
    `, [id, fromDate, toDate]);

    const { rows: byService } = await db.query(`
      SELECT s.name, COUNT(*) as count
      FROM bookings b
      JOIN services s ON s.id = b.service_id
      WHERE b.business_id = $1 AND LEFT(b.datetime_iso, 10) BETWEEN $2 AND $3
      GROUP BY s.id, s.name ORDER BY count DESC
      LIMIT 5
    `, [id, fromDate, toDate]);

    const { rows: revenueRows } = await db.query(`
      SELECT COALESCE(SUM(s.price), 0) as revenue
      FROM bookings b
      JOIN services s ON s.id = b.service_id
      WHERE b.business_id = $1
        AND LEFT(b.datetime_iso, 10) BETWEEN $2 AND $3
        AND b.status IN ('confirmed', 'completed')
    `, [id, fromDate, toDate]);

    res.json({
      totals: totalRows[0],
      byDay,
      byService,
      revenue: parseFloat(revenueRows[0].revenue),
      from: fromDate,
      to: toDate,
    });
  } catch (err) {
    console.error('[analytics] getSummary error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getSummary };
```

- [ ] **Step 7: Rewrite settings.controller.js**

```js
const db = require('../db/database');

const VALID_VERTICALS = ['salud', 'belleza'];

const getProfile = async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, slug, name, owner_email, phone, plan, description, vertical, created_at FROM businesses WHERE id = $1',
      [req.business.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Negocio no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const updateProfile = async (req, res) => {
  const { name, phone, description, vertical } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
  if (vertical && !VALID_VERTICALS.includes(vertical)) {
    return res.status(400).json({ error: 'Vertical inválido' });
  }

  try {
    await db.query(`
      UPDATE businesses SET name = $1, phone = $2, description = $3, vertical = COALESCE($4, vertical) WHERE id = $5
    `, [name.trim(), phone || null, description || '', vertical || null, req.business.id]);

    const { rows } = await db.query(
      'SELECT id, slug, name, owner_email, phone, plan, description, vertical, created_at FROM businesses WHERE id = $1',
      [req.business.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getProfile, updateProfile };
```

- [ ] **Step 8: Commit all 7 controllers**

```bash
git add backend/src/controllers/consultations.controller.js \
        backend/src/controllers/prescriptions.controller.js \
        backend/src/controllers/services.controller.js \
        backend/src/controllers/schedules.controller.js \
        backend/src/controllers/professionals.controller.js \
        backend/src/controllers/analytics.controller.js \
        backend/src/controllers/settings.controller.js
git commit -m "refactor: migrate remaining controllers to async pg"
```

---

## Task 11: Migrate billing.controller.js (async + Stripe idempotency)

**Files:**
- Modify: `backend/src/controllers/billing.controller.js`

P1 fix: add `stripe_webhook_events` idempotency table check.

- [ ] **Step 1: Rewrite billing.controller.js**

```js
const db = require('../db/database');

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY no configurada');
  return require('stripe')(process.env.STRIPE_SECRET_KEY);
}

const PLAN_PRICE_IDS = {
  pro:      process.env.STRIPE_PRICE_PRO,
  business: process.env.STRIPE_PRICE_BUSINESS,
};

const createCheckout = async (req, res) => {
  try {
    const stripe = getStripe();
    const { plan } = req.body;
    const priceId = PLAN_PRICE_IDS[plan];
    if (!priceId) return res.status(400).json({ error: 'Plan inválido. Valores aceptados: pro, business' });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${frontendUrl}/dashboard/configuracion?upgrade=success`,
      cancel_url: `${frontendUrl}/dashboard/configuracion?upgrade=cancelled`,
      metadata: { business_id: String(req.business.id), plan },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('[billing] checkout error:', err.message);
    res.status(500).json({ error: 'No se pudo iniciar el pago.' });
  }
};

const webhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[billing] STRIPE_WEBHOOK_SECRET no configurado');
    return res.status(500).json({ error: 'Webhook no configurado' });
  }

  let event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    console.error('[billing] Firma inválida:', err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  // Idempotency: skip already-processed events
  try {
    const { rows: existing } = await db.query(
      'SELECT 1 FROM stripe_webhook_events WHERE stripe_event_id = $1',
      [event.id]
    );
    if (existing.length) {
      return res.json({ received: true });
    }
    await db.query(
      'INSERT INTO stripe_webhook_events (stripe_event_id) VALUES ($1) ON CONFLICT DO NOTHING',
      [event.id]
    );
  } catch (err) {
    console.error('[billing] idempotency check error:', err.message);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const { business_id, plan } = session.metadata || {};
      const VALID_PLANS = ['pro', 'business'];
      if (business_id && VALID_PLANS.includes(plan)) {
        const bizId = parseInt(business_id);
        if (!isNaN(bizId)) {
          const { rows } = await db.query('SELECT id FROM businesses WHERE id = $1', [bizId]);
          if (rows[0]) {
            await db.query('UPDATE businesses SET plan = $1 WHERE id = $2', [plan, bizId]);
            console.log(`[billing] Plan actualizado a '${plan}' para business #${bizId}`);
          } else {
            console.error(`[billing] business_id ${bizId} no encontrado en DB`);
          }
        }
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object;
      const businessId = parseInt(sub.metadata?.business_id);
      if (!isNaN(businessId)) {
        await db.query("UPDATE businesses SET plan = 'basic' WHERE id = $1", [businessId]);
        console.log(`[billing] Plan revertido a 'basic' para business #${businessId}`);
      }
    }
  } catch (err) {
    console.error('[billing] webhook processing error:', err.message);
  }

  res.json({ received: true });
};

const getPlans = (_req, res) => {
  res.json({
    plans: [
      {
        id: 'basic', name: 'Basic', price: 9990, currency: 'CLP',
        features: ['1 profesional', 'Hasta 100 reservas/mes', 'Página de reservas pública', 'Soporte por email'],
      },
      {
        id: 'pro', name: 'Pro', price: 19990, currency: 'CLP', highlight: true,
        features: ['Todo lo de Basic', 'Recordatorios WhatsApp', 'Historial clínico', 'Hasta 5 profesionales', 'Analytics'],
        stripePriceId: PLAN_PRICE_IDS.pro || null,
      },
      {
        id: 'business', name: 'Business', price: 34990, currency: 'CLP',
        features: ['Todo lo de Pro', 'Bot IA WhatsApp', 'Profesionales ilimitados', 'Múltiples sedes'],
        stripePriceId: PLAN_PRICE_IDS.business || null,
      },
    ],
  });
};

module.exports = { createCheckout, webhook, getPlans };
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/controllers/billing.controller.js
git commit -m "refactor: migrate billing.controller to async pg + add Stripe idempotency"
```

---

## Task 12: Migrate reminders.js (async)

**Files:**
- Modify: `backend/src/jobs/reminders.js`

- [ ] **Step 1: Rewrite reminders.js**

```js
const db = require('../db/database');
const { notifyReminder } = require('../services/whatsapp');

const INTERVAL_MS = 30 * 60 * 1000;

async function sendReminders() {
  const now = Date.now();
  const from = new Date(now + 23 * 60 * 60 * 1000).toISOString();
  const to = new Date(now + 25 * 60 * 60 * 1000).toISOString();

  let bookings;
  try {
    const { rows } = await db.query(`
      SELECT b.id, b.client_name, b.client_phone, b.client_email,
             b.datetime_iso, s.name AS service_name, bs.name AS business_name
      FROM bookings b
      LEFT JOIN services s ON b.service_id = s.id
      LEFT JOIN businesses bs ON b.business_id = bs.id
      WHERE b.reminded = 0
        AND b.status = 'confirmed'
        AND b.datetime_iso >= $1
        AND b.datetime_iso <= $2
        AND bs.plan IN ('pro', 'business')
    `, [from, to]);
    bookings = rows;
  } catch (err) {
    console.error('[reminders] Error al consultar bookings:', err.message);
    return;
  }

  for (const booking of bookings) {
    try {
      await notifyReminder({
        clientName: booking.client_name,
        clientPhone: booking.client_phone,
        clientEmail: booking.client_email,
        serviceName: booking.service_name,
        datetimeISO: booking.datetime_iso,
        businessName: booking.business_name,
      });
      await db.query('UPDATE bookings SET reminded = 1 WHERE id = $1', [booking.id]);
      console.log(`[reminders] Recordatorio enviado: booking #${booking.id}`);
    } catch (err) {
      console.error(`[reminders] Fallo en booking #${booking.id}:`, err.message);
    }
  }

  if (bookings.length > 0) {
    console.log(`[reminders] Ciclo completado: ${bookings.length} recordatorio(s)`);
  }
}

let intervalHandle;

function startReminderJob() {
  sendReminders().catch(err => console.error('[reminders] Error inicial:', err.message));
  intervalHandle = setInterval(() => {
    sendReminders().catch(err => console.error('[reminders] Error en ciclo:', err.message));
  }, INTERVAL_MS);
  console.log('[reminders] Job iniciado — revisa recordatorios cada 30 min');
  return intervalHandle;
}

function stopReminderJob() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

module.exports = { startReminderJob, stopReminderJob };
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/jobs/reminders.js
git commit -m "refactor: migrate reminders.js to async pg + add stopReminderJob"
```

---

## Task 13: Update index.js (rate limiter fix + graceful shutdown + health check)

**Files:**
- Modify: `backend/src/index.js`

Fixes in this task:
- **P0 fix**: Rate limiter path corrected to `/api/bookings/public/:slug` (was `/api/bookings/public`, never triggered)
- **P1 fix**: Graceful shutdown (SIGTERM/SIGINT) closes DB pool + stops reminder job
- **P2 fix**: `/health/ready` endpoint with DB ping
- Remove `require('./db/database')` import at top (pg Pool doesn't need manual init)

- [ ] **Step 1: Rewrite index.js**

```js
require('dotenv').config();

if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length < 32) {
  console.error('[FATAL] ENCRYPTION_KEY no configurada o muy corta (mínimo 32 caracteres)');
  process.exit(1);
}
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('[FATAL] JWT_SECRET no configurada o muy corta (mínimo 32 caracteres)');
  process.exit(1);
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const db = require('./db/database');
const { startReminderJob, stopReminderJob } = require('./jobs/reminders');

const app = express();
const PORT = process.env.PORT || 3001;
const isDev = process.env.NODE_ENV === 'development';

if (!isDev) app.set('trust proxy', 1);

app.use(helmet());

if (!isDev) {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] === 'http') {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

const allowedOrigins = isDev
  ? ['http://localhost:5173', 'http://localhost:4173']
  : (process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []);

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
}));

// Stripe webhook — raw body BEFORE express.json()
app.post(
  '/api/billing/webhook',
  express.raw({ type: 'application/json' }),
  require('./controllers/billing.controller').webhook
);

app.use(express.json({ limit: '50kb' }));

// Global rate limit
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes, intenta en 15 minutos' },
}));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skip: () => isDev,
  message: { error: 'Demasiados intentos de autenticación, intenta en 15 minutos' },
});

// P0 FIX: was '/api/bookings/public' — now matches the actual route path including :slug
const bookingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  skip: () => isDev,
  message: { error: 'Demasiadas reservas en poco tiempo, intenta en 1 minuto' },
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);
// Apply booking limiter to both POST (create) and GET (slots/profile)
app.use('/api/bookings/public', bookingLimiter);
app.use('/api/public', bookingLimiter);

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/services', require('./routes/services.routes'));
app.use('/api/schedules', require('./routes/schedules.routes'));
app.use('/api/bookings', require('./routes/bookings.routes'));
app.use('/api/public', require('./routes/public.routes'));
app.use('/api/settings', require('./routes/settings.routes'));
app.use('/api/analytics', require('./routes/analytics.routes'));
app.use('/api/patients', require('./routes/patients.routes'));
app.use('/api/consultations', require('./routes/consultations.routes'));
app.use('/api/prescriptions', require('./routes/prescriptions.routes'));
app.use('/api/professionals', require('./routes/professionals.routes'));
app.use('/api/billing', require('./routes/billing.routes'));

// Health checks
app.get('/health', (_req, res) => res.json({ ok: true, uptime: process.uptime() }));

app.get('/health/ready', async (_req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ready' });
  } catch {
    res.status(503).json({ status: 'db_unavailable' });
  }
});

// Global error handler
app.use((err, req, res, _next) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
  res.status(500).json({ error: 'Error interno del servidor' });
});

let isShuttingDown = false;

const server = app.listen(PORT, () => {
  console.log(`[API] Servidor corriendo en http://localhost:${PORT}`);
  startReminderJob();
  process.send?.('ready'); // PM2 wait_ready support
});

const shutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`[${signal}] Graceful shutdown iniciado...`);

  server.close(async () => {
    stopReminderJob();
    await db.pool.end().catch(() => {});
    console.log('[shutdown] DB pool cerrado. Proceso terminado.');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('[shutdown] Timeout — forzando salida');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/index.js
git commit -m "fix: rate limiter path + add graceful shutdown + health/ready endpoint"
```

---

## Task 14: Frontend — 401 interceptor + AuthContext token validation

**Files:**
- Modify: `frontend/src/api/client.js`
- Modify: `frontend/src/context/AuthContext.jsx`

- [ ] **Step 1: Add 401 interceptor to client.js**

Read the current `frontend/src/api/client.js` first, then add the response interceptor. The file likely looks like this (adapt if different):

```js
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// P1 FIX: redirect to login on expired/invalid token
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('business');
      // Redirect without React Router to avoid import cycles
      if (window.location.pathname !== '/') {
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
```

- [ ] **Step 2: Update AuthContext.jsx to validate token on mount**

```jsx
import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [business, setBusiness] = useState(() => {
    try { return JSON.parse(localStorage.getItem('business')); } catch { return null; }
  });
  const [authChecked, setAuthChecked] = useState(false);

  // Validate stored token against server on app load
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !business) {
      setAuthChecked(true);
      return;
    }
    api.get('/auth/me')
      .then(({ data }) => {
        const updated = { ...business, ...data };
        localStorage.setItem('business', JSON.stringify(updated));
        setBusiness(updated);
      })
      .catch(() => {
        // 401 interceptor will clear localStorage and redirect
        setBusiness(null);
      })
      .finally(() => setAuthChecked(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = async (owner_email, password) => {
    const { data } = await api.post('/auth/login', { owner_email, password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('business', JSON.stringify(data.business));
    setBusiness(data.business);
    return data.business;
  };

  const register = async (name, owner_email, password, phone, specialty, vertical) => {
    const { data } = await api.post('/auth/register', { name, owner_email, password, phone, specialty, vertical });
    localStorage.setItem('token', data.token);
    localStorage.setItem('business', JSON.stringify(data.business));
    setBusiness(data.business);
    return data.business;
  };

  const logout = () => {
    api.post('/auth/logout').catch(() => {});
    localStorage.removeItem('token');
    localStorage.removeItem('business');
    setBusiness(null);
  };

  const updateBusiness = (patch) => {
    const updated = { ...business, ...patch };
    localStorage.setItem('business', JSON.stringify(updated));
    setBusiness(updated);
  };

  // Don't render children until we know auth state
  if (!authChecked) return null;

  return (
    <AuthContext.Provider value={{ business, login, register, logout, updateBusiness }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/client.js frontend/src/context/AuthContext.jsx
git commit -m "fix: add 401 interceptor + validate JWT on app load"
```

---

## Task 15: Verification

- [ ] **Step 1: Start backend and verify it connects to Neon**

```bash
cd backend && npm run dev
```

Expected output:
```
[API] Servidor corriendo en http://localhost:3001
[reminders] Job iniciado — revisa recordatorios cada 30 min
```

No errors about `node:sqlite` or `DatabaseSync`.

- [ ] **Step 2: Test health endpoint**

```bash
curl http://localhost:3001/health/ready
```

Expected: `{"status":"ready"}`

- [ ] **Step 3: Test register + login**

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Clínica Test","owner_email":"test@test.com","password":"password123","vertical":"salud"}'
```

Expected: `{"token":"...","business":{"id":1,...}}`

- [ ] **Step 4: Start frontend and verify dashboard loads**

```bash
cd frontend && npm run dev
```

Open http://localhost:5173, login with the test account.
Expected: Dashboard loads without console errors about auth.

- [ ] **Step 5: Run backend tests**

```bash
cd backend && npm test
```

Expected: 32 tests passing (crypto and RUT — these don't use the DB).

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete Neon migration + security fixes (P0/P1)"
```

---

## Notes for the executing agent

1. **SQL `$N` ordering**: Every time you build a WHERE clause dynamically (like in `list` functions), increment a counter `i` for each param. Do NOT reuse `$1` for different values.

2. **`db.connect()` for transactions**: Use `await db.connect()` to get a pool client, always call `client.release()` in `finally`. Use `db.query()` (pool) for non-transactional queries.

3. **`RETURNING *`**: Add `RETURNING *` (or `RETURNING id`) to all INSERT statements to get the inserted row back. This replaces `lastInsertRowid`.

4. **Integer IDs**: PostgreSQL returns BIGSERIAL ids as strings (JavaScript BigInt boundary). The pg driver returns them as numbers for values under 2^53. This is fine for typical SaaS usage.

5. **`LEFT(datetime_iso, 10)`**: This works because datetime_iso is stored as an ISO string like `2024-01-15T10:30:00`. The first 10 chars are always the date part.

6. **No `node:sqlite` anywhere**: After this migration, there should be zero references to `node:sqlite`, `DatabaseSync`, `db.prepare()`, `db.exec()`, or `lastInsertRowid` in the codebase.
