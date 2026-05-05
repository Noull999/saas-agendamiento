# SaaS Salud Vertical — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the scheduling SaaS into a healthcare vertical for Chilean independent professionals (kinesiologists, psychologists, nutritionists, dentists) with encrypted patient records, consultation history, prescriptions, and compliance with Ley 20.584 and Ley 19.628.

**Architecture:** New DB tables (professionals, patients, consultations, prescriptions) are added to the existing SQLite database. Sensitive fields (allergies, background, notes, diagnosis, treatment, prescriptions) are AES-256-CBC encrypted at the service layer using `node:crypto`. Four new route modules follow the existing MVC pattern (routes → controller → db). Frontend adds two new pages (Patients, Professionals) and extends existing ones (Bookings, Register, Layout, BookingPage).

**Tech Stack:** Node.js 22+, Express, SQLite via `node:sqlite` (DatabaseSync — synchronous, no async/await), React 18 + Vite, React Router 6, Tailwind CSS, axios. All backend code is CommonJS (`require`). No new npm dependencies.

**Note on WhatsApp integration:** `backend/src/services/whatsapp.js` already implements the full integration (non-blocking fetch to `WHATSAPP_BOT_URL/notify`). The call in `publicCreate` already uses `.catch()` without await. This requirement is satisfied — no changes needed there.

---

## File Map

### New backend files
| File | Responsibility |
|---|---|
| `backend/src/lib/crypto.js` | `encrypt(text)` / `decrypt(text)` using AES-256-CBC, node:crypto only |
| `backend/src/controllers/patients.controller.js` | CRUD for patients, RUT validation, history, export |
| `backend/src/routes/patients.routes.js` | Route definitions for `/api/patients` |
| `backend/src/controllers/consultations.controller.js` | CRUD for consultations with encrypt/decrypt |
| `backend/src/routes/consultations.routes.js` | Route definitions for `/api/consultations` |
| `backend/src/controllers/prescriptions.controller.js` | create, get, download (text fallback for PDF) |
| `backend/src/routes/prescriptions.routes.js` | Route definitions for `/api/prescriptions` |
| `backend/src/controllers/professionals.controller.js` | CRUD with soft delete |
| `backend/src/routes/professionals.routes.js` | Route definitions for `/api/professionals` |

### Modified backend files
| File | Change |
|---|---|
| `backend/src/db/database.js` | Add 4 new tables + 5 ALTER TABLE migrations |
| `backend/src/index.js` | ENCRYPTION_KEY startup validation + register 4 new route prefixes |
| `backend/src/controllers/auth.controller.js` | Accept `specialty` on register, save to DB |
| `backend/src/controllers/bookings.controller.js` | JOIN patients in list query to return `patient_name` |
| `backend/src/routes/public.routes.js` | Add `GET /:slug/slots` + expose `specialty` in existing profile endpoint |
| `backend/.env.example` | Add ENCRYPTION_KEY and WHATSAPP vars |

### New frontend files
| File | Responsibility |
|---|---|
| `frontend/src/pages/Patients.jsx` | Patient list with search/debounce + new patient modal |
| `frontend/src/pages/PatientDetail.jsx` | Patient detail, consultation history, new consultation/prescription modals |
| `frontend/src/pages/Professionals.jsx` | Professional CRUD (Pro/Clinic plan only) |

### Modified frontend files
| File | Change |
|---|---|
| `frontend/src/context/AuthContext.jsx` | Pass `specialty` param from `register()` |
| `frontend/src/pages/Register.jsx` | Add specialty select field |
| `frontend/src/pages/Bookings.jsx` | Add patient column, link-patient modal, new-consultation button |
| `frontend/src/components/Layout.jsx` | Add Pacientes + Profesionales sidebar links |
| `frontend/src/App.jsx` | Add routes for `/dashboard/pacientes`, `/dashboard/pacientes/:id`, `/dashboard/profesionales` |
| `frontend/src/pages/BookingPage.jsx` | Add RUT field (required when specialty != 'general'), send `client_rut` |

---

## Task 1: Create `backend/src/lib/crypto.js`

**Files:**
- Create: `backend/src/lib/crypto.js`

- [ ] **Step 1: Write the file**

```js
// backend/src/lib/crypto.js
const { createCipheriv, createDecipheriv, randomBytes } = require('node:crypto');

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

function getKey() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length < 32) throw new Error('[crypto] ENCRYPTION_KEY no configurada o muy corta');
  return Buffer.from(key.slice(0, 32), 'utf8');
}

function encrypt(text) {
  if (text == null) return null;
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
  if (text == null) return null;
  const parts = String(text).split(':');
  if (parts.length !== 2) return null;
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = Buffer.from(parts[1], 'hex');
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

module.exports = { encrypt, decrypt };
```

- [ ] **Step 2: Smoke-test via node REPL**

```
cd backend
ENCRYPTION_KEY=12345678901234567890123456789012 node -e "
const { encrypt, decrypt } = require('./src/lib/crypto');
const c = encrypt('hola mundo');
console.log('encrypted:', c);
console.log('decrypted:', decrypt(c));
console.log('null ok:', encrypt(null), decrypt(null));
"
```

Expected: `decrypted: hola mundo`, nulls return null, no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/lib/crypto.js
git commit -m "feat(health): add AES-256-CBC encrypt/decrypt lib"
```

---

## Task 2: Extend `backend/src/db/database.js` — new tables and migrations

**Files:**
- Modify: `backend/src/db/database.js`

- [ ] **Step 1: Add 4 new CREATE TABLE statements and 5 ALTER TABLE migrations**

After the closing `);` of the existing `db.exec(...)` block (line 60), and after the existing `ALTER TABLE businesses ADD COLUMN description` block (lines 62-66), add:

```js
db.exec(`
  CREATE TABLE IF NOT EXISTS professionals (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name        TEXT    NOT NULL,
    specialty   TEXT    NOT NULL,
    email       TEXT,
    active      INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS patients (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id  INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    rut          TEXT    NOT NULL,
    name         TEXT    NOT NULL,
    birth_date   TEXT,
    phone        TEXT,
    email        TEXT,
    allergies    TEXT,
    background   TEXT,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(business_id, rut)
  );

  CREATE TABLE IF NOT EXISTS consultations (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id     INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    patient_id      INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    booking_id      INTEGER REFERENCES bookings(id),
    professional_id INTEGER REFERENCES professionals(id),
    notes           TEXT,
    diagnosis       TEXT,
    treatment       TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS prescriptions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    consultation_id INTEGER NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
    content         TEXT    NOT NULL,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`);

[
  "ALTER TABLE businesses ADD COLUMN specialty TEXT DEFAULT 'general'",
  "ALTER TABLE bookings ADD COLUMN patient_id INTEGER REFERENCES patients(id)",
  "ALTER TABLE bookings ADD COLUMN professional_id INTEGER REFERENCES professionals(id)",
  "ALTER TABLE bookings ADD COLUMN reminded INTEGER DEFAULT 0",
  "ALTER TABLE bookings ADD COLUMN client_rut TEXT"
].forEach(sql => { try { db.exec(sql); } catch (_) {} });
```

- [ ] **Step 2: Verify schema via node**

```
cd backend
node -e "require('dotenv').config(); process.env.ENCRYPTION_KEY='12345678901234567890123456789012'; const db = require('./src/db/database'); console.log(db.prepare(\"SELECT name FROM sqlite_master WHERE type='table'\").all());"
```

Expected output includes: `businesses, services, schedules, bookings, professionals, patients, consultations, prescriptions`.

- [ ] **Step 3: Commit**

```bash
git add backend/src/db/database.js
git commit -m "feat(health): add professionals, patients, consultations, prescriptions tables"
```

---

## Task 3: Add ENCRYPTION_KEY startup validation to `backend/src/index.js`

**Files:**
- Modify: `backend/src/index.js`

- [ ] **Step 1: Add validation block immediately after `require('dotenv').config()`**

Current line 1: `require('dotenv').config();`
Current line 2: `require('./db/database');`

Insert between them:

```js
require('dotenv').config();

if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length < 32) {
  console.error('[FATAL] ENCRYPTION_KEY no configurada o muy corta (mínimo 32 caracteres)');
  process.exit(1);
}

require('./db/database');
```

- [ ] **Step 2: Verify it fails without the key**

```
cd backend
node src/index.js
```

Expected: `[FATAL] ENCRYPTION_KEY no configurada o muy corta...` and process exits.

- [ ] **Step 3: Verify it starts with the key (using .env)**

Add to `backend/.env` temporarily:
```
ENCRYPTION_KEY=12345678901234567890123456789012
```
Then: `node src/index.js` → server starts normally.

- [ ] **Step 4: Commit**

```bash
git add backend/src/index.js
git commit -m "feat(health): fail fast if ENCRYPTION_KEY missing or too short"
```

---

## Task 4: Create patients controller and routes

**Files:**
- Create: `backend/src/controllers/patients.controller.js`
- Create: `backend/src/routes/patients.routes.js`

- [ ] **Step 1: Create the controller**

```js
// backend/src/controllers/patients.controller.js
const db = require('../db/database');
const { encrypt, decrypt } = require('../lib/crypto');

function isValidRut(rut) {
  const cleaned = String(rut).replace(/\./g, '').replace(/-/g, '').trim().toLowerCase();
  if (cleaned.length < 2) return false;
  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);
  if (!/^\d+$/.test(body)) return false;
  let sum = 0, m = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * m;
    m = m === 7 ? 2 : m + 1;
  }
  const mod = 11 - (sum % 11);
  const expected = mod === 11 ? '0' : mod === 10 ? 'k' : String(mod);
  return dv === expected;
}

const list = (req, res) => {
  const { search, page = '1', limit = '20' } = req.query;
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const offset = (pageNum - 1) * limitNum;

  let where = 'WHERE business_id = ?';
  const params = [req.business.id];

  if (search) {
    where += ' AND (LOWER(name) LIKE ? OR LOWER(rut) LIKE ?)';
    const s = `%${search.toLowerCase()}%`;
    params.push(s, s);
  }

  const { total } = db.prepare(`SELECT COUNT(*) as total FROM patients ${where}`).get(...params);
  const patients = db.prepare(
    `SELECT id, rut, name, birth_date, phone, email, created_at FROM patients ${where} ORDER BY name ASC LIMIT ? OFFSET ?`
  ).all(...params, limitNum, offset);

  res.json({ patients, total, page: pageNum, pages: Math.ceil(total / limitNum) });
};

const getById = (req, res) => {
  const patient = db.prepare('SELECT * FROM patients WHERE id = ? AND business_id = ?').get(req.params.id, req.business.id);
  if (!patient) return res.status(404).json({ error: 'Paciente no encontrado' });

  if (patient.allergies) patient.allergies = decrypt(patient.allergies);
  if (patient.background) patient.background = decrypt(patient.background);

  const consultations = db.prepare(`
    SELECT c.id, c.created_at, c.diagnosis, pr.name as professional_name
    FROM consultations c
    LEFT JOIN professionals pr ON c.professional_id = pr.id
    WHERE c.patient_id = ? AND c.business_id = ?
    ORDER BY c.created_at DESC LIMIT 5
  `).all(patient.id, req.business.id);

  consultations.forEach(c => { if (c.diagnosis) c.diagnosis = decrypt(c.diagnosis); });

  res.json({ ...patient, recent_consultations: consultations });
};

const create = (req, res) => {
  const { rut, name, birth_date, phone, email, allergies, background } = req.body;
  if (!rut || !name) return res.status(400).json({ error: 'rut y name son requeridos' });
  if (!isValidRut(rut)) return res.status(400).json({ error: 'RUT inválido' });

  const existing = db.prepare('SELECT id FROM patients WHERE business_id = ? AND rut = ?').get(req.business.id, rut);
  if (existing) return res.status(409).json({ error: 'Paciente ya registrado', patient_id: existing.id });

  const result = db.prepare(`
    INSERT INTO patients (business_id, rut, name, birth_date, phone, email, allergies, background)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.business.id, rut, name.trim(),
    birth_date || null, phone || null, email || null,
    allergies ? encrypt(allergies) : null,
    background ? encrypt(background) : null
  );

  const patient = db.prepare('SELECT id, rut, name, birth_date, phone, email, created_at FROM patients WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(patient);
};

const update = (req, res) => {
  const patient = db.prepare('SELECT * FROM patients WHERE id = ? AND business_id = ?').get(req.params.id, req.business.id);
  if (!patient) return res.status(404).json({ error: 'Paciente no encontrado' });

  const { name, birth_date, phone, email, allergies, background } = req.body;

  db.prepare(`
    UPDATE patients SET name = ?, birth_date = ?, phone = ?, email = ?, allergies = ?, background = ?
    WHERE id = ?
  `).run(
    name !== undefined ? name.trim() : patient.name,
    birth_date !== undefined ? birth_date : patient.birth_date,
    phone !== undefined ? phone : patient.phone,
    email !== undefined ? email : patient.email,
    allergies !== undefined ? (allergies ? encrypt(allergies) : null) : patient.allergies,
    background !== undefined ? (background ? encrypt(background) : null) : patient.background,
    patient.id
  );

  res.json(db.prepare('SELECT id, rut, name, birth_date, phone, email, created_at FROM patients WHERE id = ?').get(patient.id));
};

const history = (req, res) => {
  const { page = '1', limit = '10' } = req.query;
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 10));
  const offset = (pageNum - 1) * limitNum;

  const patient = db.prepare('SELECT id FROM patients WHERE id = ? AND business_id = ?').get(req.params.id, req.business.id);
  if (!patient) return res.status(404).json({ error: 'Paciente no encontrado' });

  const { total } = db.prepare('SELECT COUNT(*) as total FROM consultations WHERE patient_id = ? AND business_id = ?').get(patient.id, req.business.id);

  const rows = db.prepare(`
    SELECT c.id, c.created_at, c.diagnosis, c.treatment, pr.name as professional_name
    FROM consultations c
    LEFT JOIN professionals pr ON c.professional_id = pr.id
    WHERE c.patient_id = ? AND c.business_id = ?
    ORDER BY c.created_at DESC LIMIT ? OFFSET ?
  `).all(patient.id, req.business.id, limitNum, offset);

  rows.forEach(r => {
    if (r.diagnosis) r.diagnosis = decrypt(r.diagnosis);
    if (r.treatment) r.treatment = decrypt(r.treatment);
  });

  res.json({ consultations: rows, total, page: pageNum, pages: Math.ceil(total / limitNum) });
};

const exportData = (req, res) => {
  const patient = db.prepare('SELECT * FROM patients WHERE id = ? AND business_id = ?').get(req.params.id, req.business.id);
  if (!patient) return res.status(404).json({ error: 'Paciente no encontrado' });

  if (patient.allergies) patient.allergies = decrypt(patient.allergies);
  if (patient.background) patient.background = decrypt(patient.background);

  const consultations = db.prepare(`
    SELECT c.*, pr.name as professional_name
    FROM consultations c
    LEFT JOIN professionals pr ON c.professional_id = pr.id
    WHERE c.patient_id = ? AND c.business_id = ?
    ORDER BY c.created_at DESC
  `).all(patient.id, req.business.id);

  consultations.forEach(c => {
    if (c.notes) c.notes = decrypt(c.notes);
    if (c.diagnosis) c.diagnosis = decrypt(c.diagnosis);
    if (c.treatment) c.treatment = decrypt(c.treatment);
    c.prescriptions = db.prepare('SELECT * FROM prescriptions WHERE consultation_id = ?').all(c.id);
    c.prescriptions.forEach(p => { if (p.content) p.content = decrypt(p.content); });
  });

  const date = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Disposition', `attachment; filename="paciente-${patient.rut}-${date}.json"`);
  res.json({ patient, consultations });
};

module.exports = { list, getById, create, update, history, exportData };
```

- [ ] **Step 2: Create the routes file**

```js
// backend/src/routes/patients.routes.js
const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/patients.controller');

router.use(auth);
router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.get('/:id/history', ctrl.history);
router.get('/:id/export', ctrl.exportData);
router.get('/:id', ctrl.getById);
router.put('/:id', ctrl.update);

module.exports = router;
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/controllers/patients.controller.js backend/src/routes/patients.routes.js
git commit -m "feat(health): add patients CRUD with RUT validation and encrypted fields"
```

---

## Task 5: Create consultations controller and routes

**Files:**
- Create: `backend/src/controllers/consultations.controller.js`
- Create: `backend/src/routes/consultations.routes.js`

- [ ] **Step 1: Create the controller**

```js
// backend/src/controllers/consultations.controller.js
const db = require('../db/database');
const { encrypt, decrypt } = require('../lib/crypto');

const list = (req, res) => {
  const { patient_id, date, professional_id } = req.query;
  let where = 'WHERE c.business_id = ?';
  const params = [req.business.id];

  if (patient_id) { where += ' AND c.patient_id = ?'; params.push(patient_id); }
  if (professional_id) { where += ' AND c.professional_id = ?'; params.push(professional_id); }
  if (date) { where += ' AND date(c.created_at) = ?'; params.push(date); }

  const rows = db.prepare(`
    SELECT c.id, c.patient_id, c.booking_id, c.professional_id,
           c.notes, c.diagnosis, c.treatment, c.created_at,
           p.name as patient_name, pr.name as professional_name
    FROM consultations c
    LEFT JOIN patients p ON c.patient_id = p.id
    LEFT JOIN professionals pr ON c.professional_id = pr.id
    ${where}
    ORDER BY c.created_at DESC
  `).all(...params);

  rows.forEach(r => {
    if (r.notes) r.notes = decrypt(r.notes);
    if (r.diagnosis) r.diagnosis = decrypt(r.diagnosis);
    if (r.treatment) r.treatment = decrypt(r.treatment);
  });

  res.json(rows);
};

const create = (req, res) => {
  const { patient_id, booking_id, professional_id, notes, diagnosis, treatment } = req.body;
  if (!patient_id) return res.status(400).json({ error: 'patient_id es requerido' });

  const patient = db.prepare('SELECT id FROM patients WHERE id = ? AND business_id = ?').get(patient_id, req.business.id);
  if (!patient) return res.status(404).json({ error: 'Paciente no encontrado' });

  if (booking_id) {
    const booking = db.prepare('SELECT id FROM bookings WHERE id = ? AND business_id = ?').get(booking_id, req.business.id);
    if (!booking) return res.status(404).json({ error: 'Reserva no encontrada' });
  }

  const result = db.prepare(`
    INSERT INTO consultations (business_id, patient_id, booking_id, professional_id, notes, diagnosis, treatment)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.business.id, patient_id,
    booking_id || null, professional_id || null,
    notes ? encrypt(notes) : null,
    diagnosis ? encrypt(diagnosis) : null,
    treatment ? encrypt(treatment) : null
  );

  const c = db.prepare('SELECT * FROM consultations WHERE id = ?').get(result.lastInsertRowid);
  if (c.notes) c.notes = decrypt(c.notes);
  if (c.diagnosis) c.diagnosis = decrypt(c.diagnosis);
  if (c.treatment) c.treatment = decrypt(c.treatment);

  res.status(201).json(c);
};

const getById = (req, res) => {
  const c = db.prepare(`
    SELECT c.*, p.name as patient_name, pr.name as professional_name
    FROM consultations c
    LEFT JOIN patients p ON c.patient_id = p.id
    LEFT JOIN professionals pr ON c.professional_id = pr.id
    WHERE c.id = ? AND c.business_id = ?
  `).get(req.params.id, req.business.id);
  if (!c) return res.status(404).json({ error: 'Consulta no encontrada' });

  if (c.notes) c.notes = decrypt(c.notes);
  if (c.diagnosis) c.diagnosis = decrypt(c.diagnosis);
  if (c.treatment) c.treatment = decrypt(c.treatment);

  const prescriptions = db.prepare('SELECT * FROM prescriptions WHERE consultation_id = ?').all(c.id);
  prescriptions.forEach(p => { if (p.content) p.content = decrypt(p.content); });

  res.json({ ...c, prescriptions });
};

const update = (req, res) => {
  const c = db.prepare('SELECT * FROM consultations WHERE id = ? AND business_id = ?').get(req.params.id, req.business.id);
  if (!c) return res.status(404).json({ error: 'Consulta no encontrada' });

  const { notes, diagnosis, treatment } = req.body;

  db.prepare('UPDATE consultations SET notes = ?, diagnosis = ?, treatment = ? WHERE id = ?').run(
    notes !== undefined ? (notes ? encrypt(notes) : null) : c.notes,
    diagnosis !== undefined ? (diagnosis ? encrypt(diagnosis) : null) : c.diagnosis,
    treatment !== undefined ? (treatment ? encrypt(treatment) : null) : c.treatment,
    c.id
  );

  const updated = db.prepare('SELECT * FROM consultations WHERE id = ?').get(c.id);
  if (updated.notes) updated.notes = decrypt(updated.notes);
  if (updated.diagnosis) updated.diagnosis = decrypt(updated.diagnosis);
  if (updated.treatment) updated.treatment = decrypt(updated.treatment);

  res.json(updated);
};

module.exports = { list, create, getById, update };
```

- [ ] **Step 2: Create the routes file**

```js
// backend/src/routes/consultations.routes.js
const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/consultations.controller');

router.use(auth);
router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.get('/:id', ctrl.getById);
router.put('/:id', ctrl.update);

module.exports = router;
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/controllers/consultations.controller.js backend/src/routes/consultations.routes.js
git commit -m "feat(health): add consultations CRUD with encrypted clinical notes"
```

---

## Task 6: Create prescriptions controller and routes

**Files:**
- Create: `backend/src/controllers/prescriptions.controller.js`
- Create: `backend/src/routes/prescriptions.routes.js`

- [ ] **Step 1: Create the controller**

```js
// backend/src/controllers/prescriptions.controller.js
const db = require('../db/database');
const { encrypt, decrypt } = require('../lib/crypto');

const create = (req, res) => {
  const { consultation_id, content } = req.body;
  if (!consultation_id || !content) return res.status(400).json({ error: 'consultation_id y content son requeridos' });

  const consultation = db.prepare('SELECT * FROM consultations WHERE id = ? AND business_id = ?').get(consultation_id, req.business.id);
  if (!consultation) return res.status(404).json({ error: 'Consulta no encontrada' });

  const result = db.prepare('INSERT INTO prescriptions (consultation_id, content) VALUES (?, ?)').run(consultation_id, encrypt(content));
  const prescription = db.prepare('SELECT * FROM prescriptions WHERE id = ?').get(result.lastInsertRowid);
  prescription.content = decrypt(prescription.content);
  res.status(201).json(prescription);
};

const getById = (req, res) => {
  const row = db.prepare(`
    SELECT pr.*, c.business_id
    FROM prescriptions pr
    JOIN consultations c ON pr.consultation_id = c.id
    WHERE pr.id = ?
  `).get(req.params.id);

  if (!row || row.business_id !== req.business.id) return res.status(404).json({ error: 'Receta no encontrada' });
  row.content = decrypt(row.content);
  res.json(row);
};

const downloadPdf = (req, res) => {
  const row = db.prepare(`
    SELECT pr.*, c.business_id, c.patient_id
    FROM prescriptions pr
    JOIN consultations c ON pr.consultation_id = c.id
    WHERE pr.id = ?
  `).get(req.params.id);

  if (!row || row.business_id !== req.business.id) return res.status(404).json({ error: 'Receta no encontrada' });

  const content = decrypt(row.content);
  const patient = db.prepare('SELECT name, rut FROM patients WHERE id = ?').get(row.patient_id);
  const business = db.prepare('SELECT name FROM businesses WHERE id = ?').get(req.business.id);
  const date = new Date().toLocaleDateString('es-CL');

  const text = [
    'RECETA / INDICACIONES',
    '=====================',
    `Establecimiento: ${business?.name || ''}`,
    `Fecha: ${date}`,
    '',
    `Paciente: ${patient?.name || 'N/A'}`,
    `RUT: ${patient?.rut || 'N/A'}`,
    '',
    'INDICACIONES:',
    '-------------',
    content,
  ].join('\n');

  res.setHeader('Content-Disposition', `attachment; filename="receta-${row.id}.txt"`);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(text);
};

module.exports = { create, getById, downloadPdf };
```

- [ ] **Step 2: Create the routes file**

```js
// backend/src/routes/prescriptions.routes.js
const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/prescriptions.controller');

router.use(auth);
router.post('/', ctrl.create);
router.get('/:id/pdf', ctrl.downloadPdf);
router.get('/:id', ctrl.getById);

module.exports = router;
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/controllers/prescriptions.controller.js backend/src/routes/prescriptions.routes.js
git commit -m "feat(health): add prescriptions with encrypted content and text download"
```

---

## Task 7: Create professionals controller and routes

**Files:**
- Create: `backend/src/controllers/professionals.controller.js`
- Create: `backend/src/routes/professionals.routes.js`

- [ ] **Step 1: Create the controller**

```js
// backend/src/controllers/professionals.controller.js
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
```

- [ ] **Step 2: Create the routes file**

```js
// backend/src/routes/professionals.routes.js
const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/professionals.controller');

router.use(auth);
router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/controllers/professionals.controller.js backend/src/routes/professionals.routes.js
git commit -m "feat(health): add professionals CRUD with soft delete"
```

---

## Task 8: Add slots endpoint and specialty to `backend/src/routes/public.routes.js`

**Files:**
- Modify: `backend/src/routes/public.routes.js`

- [ ] **Step 1: Update the file — expose `specialty` in profile + add slots endpoint**

Replace the entire file with:

```js
// backend/src/routes/public.routes.js
const router = require('express').Router();
const db = require('../db/database');

const DAYS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

// Perfil público de un negocio
router.get('/:slug', (req, res) => {
  const business = db.prepare(
    'SELECT id, slug, name, phone, specialty FROM businesses WHERE slug = ?'
  ).get(req.params.slug);

  if (!business) return res.status(404).json({ error: 'Negocio no encontrado' });

  const services = db.prepare(
    'SELECT id, name, description, duration_min, price FROM services WHERE business_id = ? AND active = 1'
  ).all(business.id);

  const scheduleRows = db.prepare(
    'SELECT dow, slots FROM schedules WHERE business_id = ?'
  ).all(business.id);

  const schedules = scheduleRows.map(r => ({ dow: r.dow, slots: JSON.parse(r.slots) }));

  res.json({ business, services, schedules });
});

// Slots disponibles (consume el bot de WhatsApp y la UI de BookingPage)
router.get('/:slug/slots', (req, res) => {
  const business = db.prepare('SELECT id FROM businesses WHERE slug = ?').get(req.params.slug);
  if (!business) return res.status(404).json({ error: 'Negocio no encontrado' });

  const days = Math.min(30, Math.max(1, parseInt(req.query.days) || 7));
  const startDate = req.query.date ? new Date(req.query.date + 'T00:00:00') : new Date();
  startDate.setHours(0, 0, 0, 0);

  const scheduleRows = db.prepare('SELECT dow, slots FROM schedules WHERE business_id = ?').all(business.id);
  const scheduleMap = {};
  scheduleRows.forEach(r => { scheduleMap[r.dow] = JSON.parse(r.slots); });

  const result = [];

  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const dow = d.getDay();
    const allSlots = scheduleMap[dow] || [];
    if (!allSlots.length) continue;

    const dateStr = d.toISOString().slice(0, 10);

    const booked = db.prepare(`
      SELECT time(datetime_iso) as t FROM bookings
      WHERE business_id = ? AND date(datetime_iso) = ? AND status != 'cancelled'
    `).all(business.id, dateStr).map(r => r.t.slice(0, 5));

    const available = allSlots.filter(s => !booked.includes(s));
    if (!available.length) continue;

    result.push({
      date: dateStr,
      dow,
      label: `${DAYS_ES[dow]} ${d.getDate()} de ${MONTHS_ES[d.getMonth()]}`,
      slots: available,
    });
  }

  res.json(result);
});

module.exports = router;
```

- [ ] **Step 2: Verify slots endpoint (requires server running)**

```bash
curl "http://localhost:3001/api/public/<your-slug>/slots?days=3"
```

Expected: JSON array with `{ date, dow, label, slots }` objects for days with schedule + available slots.

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/public.routes.js
git commit -m "feat(health): add public slots endpoint and expose specialty in profile"
```

---

## Task 9: Wire up routes in index.js + specialty in auth + patient JOIN in bookings

**Files:**
- Modify: `backend/src/index.js` (add 4 route registrations)
- Modify: `backend/src/controllers/auth.controller.js` (accept specialty on register)
- Modify: `backend/src/controllers/bookings.controller.js` (join patients in list query)

- [ ] **Step 1: Register 4 new route prefixes in `backend/src/index.js`**

After the existing route registrations (after line `app.use('/api/analytics', ...)`), add:

```js
app.use('/api/patients', require('./routes/patients.routes'));
app.use('/api/consultations', require('./routes/consultations.routes'));
app.use('/api/prescriptions', require('./routes/prescriptions.routes'));
app.use('/api/professionals', require('./routes/professionals.routes'));
```

- [ ] **Step 2: Add specialty to `backend/src/controllers/auth.controller.js`**

In the `register` function, change the destructuring and INSERT:

```js
// Change destructuring from:
const { name, owner_email, password, phone } = req.body;
// To:
const { name, owner_email, password, phone, specialty } = req.body;
```

Change the INSERT from:
```js
const result = db.prepare(`
  INSERT INTO businesses (slug, name, owner_email, password_hash, phone, plan)
  VALUES (?, ?, ?, ?, ?, 'basic')
`).run(slug, name.trim(), owner_email.toLowerCase(), password_hash, phone?.trim() || null);
```
To:
```js
const result = db.prepare(`
  INSERT INTO businesses (slug, name, owner_email, password_hash, phone, plan, specialty)
  VALUES (?, ?, ?, ?, ?, 'basic', ?)
`).run(slug, name.trim(), owner_email.toLowerCase(), password_hash, phone?.trim() || null, specialty || 'general');
```

- [ ] **Step 3: Update `backend/src/controllers/bookings.controller.js` — JOIN patients in list**

Change the `list` function's query from:
```js
let query = `
  SELECT b.*, s.name as service_name, s.duration_min
  FROM bookings b
  LEFT JOIN services s ON b.service_id = s.id
  WHERE b.business_id = ?
`;
```
To:
```js
let query = `
  SELECT b.*, s.name as service_name, s.duration_min, p.name as patient_name, p.rut as patient_rut
  FROM bookings b
  LEFT JOIN services s ON b.service_id = s.id
  LEFT JOIN patients p ON b.patient_id = p.id
  WHERE b.business_id = ?
`;
```

Also add `client_rut` to the `publicCreate` INSERT. Change:
```js
const { client_name, client_email, client_phone, service_id, datetime_iso, notes } = req.body;
```
To:
```js
const { client_name, client_email, client_phone, client_rut, service_id, datetime_iso, notes } = req.body;
```

And the INSERT from:
```js
  `).run(business.id, service_id || null, client_name, client_email || null, client_phone || null, datetime_iso, notes || null);
```
To:
```js
  `).run(business.id, service_id || null, client_name, client_email || null, client_phone || null, datetime_iso, notes || null);
```
And also change the INSERT SQL to include `client_rut`:
```js
const result = db.prepare(`
  INSERT INTO bookings (business_id, service_id, client_name, client_email, client_phone, datetime_iso, notes, source, client_rut)
  VALUES (?, ?, ?, ?, ?, ?, ?, 'web', ?)
`).run(business.id, service_id || null, client_name, client_email || null, client_phone || null, datetime_iso, notes || null, client_rut || null);
```

- [ ] **Step 4: Restart backend and smoke-test**

```bash
cd backend && npm start
curl http://localhost:3001/health
```

Then test that existing endpoints still work:
```bash
curl -H "Authorization: Bearer <token>" http://localhost:3001/api/bookings
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/index.js backend/src/controllers/auth.controller.js backend/src/controllers/bookings.controller.js
git commit -m "feat(health): register new routes, add specialty to register, expose patient in bookings list"
```

---

## Task 10: Update `.env.example`

**Files:**
- Modify: `backend/.env.example`

- [ ] **Step 1: Add the new variables**

```
PORT=3001
JWT_SECRET=cambia_esto_por_minimo_32_caracteres_aleatorios
DB_PATH=./data/saas.db
NODE_ENV=development

# En producción, poner la URL del frontend de Vercel:
# FRONTEND_URL=https://tu-app.vercel.app

# Encriptación de datos sensibles (requerido para datos de salud)
# Genera con: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=cambia_esto_por_exactamente_32_caracteres_!!

# Integración WhatsApp bot (opcional)
# WHATSAPP_BOT_URL=http://localhost:3002
# WHATSAPP_BOT_SECRET=tu-secret-aqui
```

- [ ] **Step 2: Also add ENCRYPTION_KEY to your local `backend/.env` if not already present**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy output and add to `backend/.env`:
```
ENCRYPTION_KEY=<output-from-command>
```

- [ ] **Step 3: Commit**

```bash
git add backend/.env.example
git commit -m "docs: add ENCRYPTION_KEY and WhatsApp vars to .env.example"
```

---

## Task 11: Update `AuthContext.jsx` and `Register.jsx` — add specialty

**Files:**
- Modify: `frontend/src/context/AuthContext.jsx`
- Modify: `frontend/src/pages/Register.jsx`

- [ ] **Step 1: Update `AuthContext.jsx` — accept specialty param**

Change:
```js
const register = async (name, owner_email, password, phone) => {
  const { data } = await api.post('/auth/register', { name, owner_email, password, phone });
```
To:
```js
const register = async (name, owner_email, password, phone, specialty) => {
  const { data } = await api.post('/auth/register', { name, owner_email, password, phone, specialty });
```

- [ ] **Step 2: Update `Register.jsx` — add specialty field and pass it**

Replace the full `Register.jsx` file:

```jsx
// frontend/src/pages/Register.jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const SPECIALTIES = [
  { value: 'general', label: 'General / Otro' },
  { value: 'kinesiologia', label: 'Kinesiología' },
  { value: 'psicologia', label: 'Psicología' },
  { value: 'nutricion', label: 'Nutrición' },
  { value: 'odontologia', label: 'Odontología' },
  { value: 'medicina', label: 'Medicina General' },
];

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', owner_email: '', password: '', phone: '', specialty: 'general' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await register(form.name, form.owner_email, form.password, form.phone, form.specialty);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrarse');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white';

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex w-1/2 bg-slate-900 flex-col items-center justify-center p-12 text-white">
        <div className="w-16 h-16 bg-indigo-500 rounded-2xl flex items-center justify-center text-3xl mb-6">📅</div>
        <h1 className="text-3xl font-bold mb-3">AgendaSaaS</h1>
        <p className="text-slate-400 text-center max-w-xs">
          Comienza gratis y empieza a recibir reservas en minutos.
        </p>
        <div className="mt-12 space-y-4 w-full max-w-xs">
          {['Setup en menos de 5 minutos', 'Página de reservas personalizada', 'Sin comisiones por reserva'].map(f => (
            <div key={f} className="flex items-center gap-3 text-sm text-slate-300">
              <div className="w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center text-xs">✓</div>
              {f}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center text-white text-sm">📅</div>
            <span className="font-bold text-slate-900">AgendaSaaS</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-1">Crea tu cuenta</h2>
          <p className="text-slate-500 text-sm mb-8">Empieza gratis, cancela cuando quieras</p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Nombre del negocio o consulta</label>
              <input name="name" required value={form.name} onChange={handle} className={inputClass} placeholder="Ej: Kinesiología López" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Especialidad</label>
              <select name="specialty" value={form.specialty} onChange={handle} className={inputClass}>
                {SPECIALTIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <input name="owner_email" type="email" required value={form.owner_email} onChange={handle} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Contraseña</label>
              <input name="password" type="password" required minLength={6} value={form.password} onChange={handle} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Teléfono <span className="text-slate-400 font-normal">(opcional)</span>
              </label>
              <input name="phone" value={form.phone} onChange={handle} className={inputClass} placeholder="+56 9 1234 5678" />
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
            )}
            <button
              type="submit" disabled={loading}
              className="w-full bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors mt-2"
            >
              {loading ? 'Creando cuenta...' : 'Crear cuenta gratis'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="text-indigo-600 hover:underline font-medium">Inicia sesión</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/context/AuthContext.jsx frontend/src/pages/Register.jsx
git commit -m "feat(health): add specialty field to registration form"
```

---

## Task 12: Create `frontend/src/pages/Patients.jsx`

**Files:**
- Create: `frontend/src/pages/Patients.jsx`

- [ ] **Step 1: Create the file**

```jsx
// frontend/src/pages/Patients.jsx
import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';

function isValidRut(rut) {
  const cleaned = String(rut).replace(/\./g, '').replace(/-/g, '').trim().toLowerCase();
  if (cleaned.length < 2) return false;
  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);
  if (!/^\d+$/.test(body)) return false;
  let sum = 0, m = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * m;
    m = m === 7 ? 2 : m + 1;
  }
  const mod = 11 - (sum % 11);
  const expected = mod === 11 ? '0' : mod === 10 ? 'k' : String(mod);
  return dv === expected;
}

const EMPTY_FORM = { rut: '', name: '', birth_date: '', phone: '', email: '', allergies: '', background: '' };

export default function Patients() {
  const navigate = useNavigate();
  const [data, setData] = useState({ patients: [], total: 0, page: 1, pages: 1 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef(null);

  const load = async (q = search, page = 1) => {
    setLoading(true);
    try {
      const { data: res } = await api.get('/patients', { params: { search: q || undefined, page, limit: 20 } });
      setData(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSearch = (e) => {
    const q = e.target.value;
    setSearch(q);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(q, 1), 300);
  };

  const rutStatus = form.rut.length > 2
    ? (isValidRut(form.rut) ? 'valid' : 'invalid')
    : 'neutral';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValidRut(form.rut)) { setFormError('RUT inválido'); return; }
    setSaving(true);
    setFormError('');
    try {
      await api.post('/patients', form);
      setShowModal(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pacientes</h1>
          <p className="text-slate-500 text-sm mt-0.5">{data.total} paciente{data.total !== 1 ? 's' : ''} registrado{data.total !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => { setShowModal(true); setFormError(''); setForm(EMPTY_FORM); }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors"
        >
          + Nuevo paciente
        </button>
      </div>

      <div className="mb-4">
        <input
          value={search} onChange={handleSearch}
          placeholder="Buscar por nombre o RUT..."
          className="w-full max-w-sm border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
        />
      </div>

      {loading && <p className="text-slate-400 text-sm">Cargando...</p>}

      {!loading && data.patients.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center shadow-sm">
          <p className="text-4xl mb-3">👤</p>
          <p className="text-slate-400 text-sm">No hay pacientes registrados</p>
        </div>
      )}

      {data.patients.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">RUT</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Nombre</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Teléfono</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Email</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Registrado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.patients.map(p => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-slate-700">{p.rut}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{p.name}</td>
                  <td className="px-4 py-3 text-slate-500">{p.phone || '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{p.email || '—'}</td>
                  <td className="px-4 py-3 text-slate-400">{new Date(p.created_at).toLocaleDateString('es-CL')}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => navigate(`/dashboard/pacientes/${p.id}`)}
                      className="text-indigo-600 hover:underline text-xs font-medium"
                    >
                      Ver ficha →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.pages > 1 && (
        <div className="flex gap-2 mt-4">
          {Array.from({ length: data.pages }, (_, i) => i + 1).map(p => (
            <button
              key={p} onClick={() => load(search, p)}
              className={`px-3 py-1 rounded-lg text-sm ${data.page === p ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Nuevo paciente</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  RUT *{' '}
                  {rutStatus === 'valid' && <span className="text-emerald-600">✓ válido</span>}
                  {rutStatus === 'invalid' && <span className="text-red-500">inválido</span>}
                </label>
                <input
                  required value={form.rut} onChange={e => setForm({ ...form, rut: e.target.value })}
                  placeholder="12.345.678-9" className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre completo *</label>
                <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Fecha nacimiento</label>
                  <input type="date" value={form.birth_date} onChange={e => setForm({ ...form, birth_date: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Teléfono</label>
                  <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className={inputClass} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Alergias conocidas</label>
                <textarea rows={2} value={form.allergies} onChange={e => setForm({ ...form, allergies: e.target.value })} className={`${inputClass} resize-none`} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Antecedentes médicos</label>
                <textarea rows={2} value={form.background} onChange={e => setForm({ ...form, background: e.target.value })} className={`${inputClass} resize-none`} />
              </div>
              {formError && <p className="text-red-600 text-xs">{formError}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-slate-200 rounded-xl py-2 text-sm text-slate-600 hover:bg-slate-50">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="flex-1 bg-indigo-600 text-white rounded-xl py-2 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/Patients.jsx
git commit -m "feat(health): add patients list page with search and new patient modal"
```

---

## Task 13: Create `frontend/src/pages/PatientDetail.jsx`

**Files:**
- Create: `frontend/src/pages/PatientDetail.jsx`

- [ ] **Step 1: Create the file**

```jsx
// frontend/src/pages/PatientDetail.jsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';

export default function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  const [showConsultModal, setShowConsultModal] = useState(false);
  const [consultForm, setConsultForm] = useState({ notes: '', diagnosis: '', treatment: '', professional_id: '' });
  const [consultSaving, setConsultSaving] = useState(false);

  const [showRxModal, setShowRxModal] = useState(false);
  const [rxContent, setRxContent] = useState('');
  const [rxConsultId, setRxConsultId] = useState(null);
  const [rxSaving, setRxSaving] = useState(false);

  const [professionals, setProfessionals] = useState([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [{ data: p }, { data: h }, { data: profs }] = await Promise.all([
        api.get(`/patients/${id}`),
        api.get(`/patients/${id}/history`),
        api.get('/professionals'),
      ]);
      setPatient(p);
      setEditForm({ name: p.name, birth_date: p.birth_date || '', phone: p.phone || '', email: p.email || '', allergies: p.allergies || '', background: p.background || '' });
      setHistory(h.consultations);
      setProfessionals(profs);
    } catch {
      navigate('/dashboard/pacientes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [id]);

  const saveEdit = async () => {
    setSaving(true);
    try {
      await api.put(`/patients/${id}`, editForm);
      setEditing(false);
      loadData();
    } finally {
      setSaving(false);
    }
  };

  const saveConsult = async (e) => {
    e.preventDefault();
    setConsultSaving(true);
    try {
      await api.post('/consultations', { patient_id: parseInt(id), ...consultForm, professional_id: consultForm.professional_id || undefined });
      setShowConsultModal(false);
      setConsultForm({ notes: '', diagnosis: '', treatment: '', professional_id: '' });
      loadData();
    } finally {
      setConsultSaving(false);
    }
  };

  const saveRx = async (e) => {
    e.preventDefault();
    setRxSaving(true);
    try {
      const { data } = await api.post('/prescriptions', { consultation_id: rxConsultId, content: rxContent });
      setShowRxModal(false);
      setRxContent('');
      // trigger download
      window.open(`/api/prescriptions/${data.id}/pdf`);
    } finally {
      setRxSaving(false);
    }
  };

  const inputClass = 'w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white';

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!patient) return null;

  return (
    <div className="max-w-3xl">
      <button onClick={() => navigate('/dashboard/pacientes')} className="text-sm text-slate-400 hover:text-slate-700 mb-6 flex items-center gap-1">
        ← Volver a pacientes
      </button>

      {/* Patient data */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{patient.name}</h1>
            <p className="text-sm text-slate-500 font-mono">{patient.rut}</p>
          </div>
          <button onClick={() => setEditing(!editing)} className="text-sm text-indigo-600 hover:underline">
            {editing ? 'Cancelar' : 'Editar datos'}
          </button>
        </div>

        {!editing ? (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-slate-400">Teléfono:</span> <span className="text-slate-700">{patient.phone || '—'}</span></div>
            <div><span className="text-slate-400">Email:</span> <span className="text-slate-700">{patient.email || '—'}</span></div>
            <div><span className="text-slate-400">Nacimiento:</span> <span className="text-slate-700">{patient.birth_date || '—'}</span></div>
            <div><span className="text-slate-400">Registrado:</span> <span className="text-slate-700">{new Date(patient.created_at).toLocaleDateString('es-CL')}</span></div>
            {patient.allergies && <div className="col-span-2"><span className="text-slate-400">Alergias:</span> <span className="text-slate-700">{patient.allergies}</span></div>}
            {patient.background && <div className="col-span-2"><span className="text-slate-400">Antecedentes:</span> <span className="text-slate-700">{patient.background}</span></div>}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre</label>
                <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Fecha nacimiento</label>
                <input type="date" value={editForm.birth_date} onChange={e => setEditForm({ ...editForm, birth_date: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Teléfono</label>
                <input value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                <input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} className={inputClass} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Alergias</label>
              <textarea rows={2} value={editForm.allergies} onChange={e => setEditForm({ ...editForm, allergies: e.target.value })} className={`${inputClass} resize-none`} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Antecedentes</label>
              <textarea rows={2} value={editForm.background} onChange={e => setEditForm({ ...editForm, background: e.target.value })} className={`${inputClass} resize-none`} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditing(false)} className="flex-1 border border-slate-200 rounded-xl py-2 text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
              <button onClick={saveEdit} disabled={saving} className="flex-1 bg-indigo-600 text-white rounded-xl py-2 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Consultation history */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-slate-900">Historial de consultas</h2>
          <div className="flex gap-2">
            <button
              onClick={() => { setRxConsultId(null); setShowRxModal(true); }}
              className="text-sm border border-slate-200 px-3 py-1.5 rounded-xl text-slate-600 hover:bg-slate-50"
            >
              Nueva receta
            </button>
            <button
              onClick={() => setShowConsultModal(true)}
              className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-xl hover:bg-indigo-700"
            >
              + Nueva consulta
            </button>
          </div>
        </div>

        {history.length === 0 && <p className="text-slate-400 text-sm">No hay consultas registradas</p>}

        <div className="space-y-3">
          {history.map(c => (
            <div key={c.id} className="border border-slate-100 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-xs text-slate-400 mb-1">{new Date(c.created_at).toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' })}{c.professional_name ? ` · ${c.professional_name}` : ''}</p>
                  {c.diagnosis && <p className="text-sm text-slate-700"><span className="font-medium">Diagnóstico:</span> {c.diagnosis}</p>}
                  {c.treatment && <p className="text-sm text-slate-500 mt-1"><span className="font-medium">Tratamiento:</span> {c.treatment}</p>}
                </div>
                <button
                  onClick={() => { setRxConsultId(c.id); setShowRxModal(true); }}
                  className="text-xs text-indigo-600 hover:underline shrink-0"
                >
                  Receta
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* New consultation modal */}
      {showConsultModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Nueva consulta</h2>
            <form onSubmit={saveConsult} className="space-y-3">
              {professionals.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Profesional</label>
                  <select value={consultForm.professional_id} onChange={e => setConsultForm({ ...consultForm, professional_id: e.target.value })} className={inputClass}>
                    <option value="">Sin profesional</option>
                    {professionals.map(p => <option key={p.id} value={p.id}>{p.name} — {p.specialty}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notas clínicas</label>
                <textarea rows={3} value={consultForm.notes} onChange={e => setConsultForm({ ...consultForm, notes: e.target.value })} className={`${inputClass} resize-none`} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Diagnóstico</label>
                <textarea rows={2} value={consultForm.diagnosis} onChange={e => setConsultForm({ ...consultForm, diagnosis: e.target.value })} className={`${inputClass} resize-none`} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tratamiento / indicaciones</label>
                <textarea rows={2} value={consultForm.treatment} onChange={e => setConsultForm({ ...consultForm, treatment: e.target.value })} className={`${inputClass} resize-none`} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowConsultModal(false)} className="flex-1 border border-slate-200 rounded-xl py-2 text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
                <button type="submit" disabled={consultSaving} className="flex-1 bg-indigo-600 text-white rounded-xl py-2 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
                  {consultSaving ? 'Guardando...' : 'Guardar consulta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New prescription modal */}
      {showRxModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Nueva receta</h2>
            {!rxConsultId && history.length === 0 && <p className="text-amber-600 text-xs mb-3">Debes tener al menos una consulta para emitir una receta.</p>}
            {!rxConsultId && history.length > 0 && <p className="text-slate-500 text-xs mb-3">Se asociará a la consulta más reciente.</p>}
            <form onSubmit={saveRx} className="space-y-3">
              <textarea
                required rows={6}
                value={rxContent} onChange={e => setRxContent(e.target.value)}
                placeholder="Medicamentos, indicaciones, dosis..."
                className={`${inputClass} resize-none`}
              />
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowRxModal(false)} className="flex-1 border border-slate-200 rounded-xl py-2 text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
                <button
                  type="submit"
                  disabled={rxSaving || (!rxConsultId && history.length === 0)}
                  onClick={() => { if (!rxConsultId && history[0]) setRxConsultId(history[0].id); }}
                  className="flex-1 bg-indigo-600 text-white rounded-xl py-2 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
                >
                  {rxSaving ? 'Guardando...' : 'Guardar y descargar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/PatientDetail.jsx
git commit -m "feat(health): add patient detail page with consultation history and prescription modals"
```

---

## Task 14: Update `frontend/src/pages/Bookings.jsx` — patient column and link patient

**Files:**
- Modify: `frontend/src/pages/Bookings.jsx`

- [ ] **Step 1: Replace the Bookings.jsx file with the updated version**

```jsx
// frontend/src/pages/Bookings.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';

const STATUS_LABELS = {
  confirmed: { label: 'Confirmada', color: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'Cancelada', color: 'bg-red-100 text-red-600' },
  completed: { label: 'Completada', color: 'bg-slate-100 text-slate-600' },
  no_show: { label: 'No asistió', color: 'bg-amber-100 text-amber-700' },
};

function initials(name = '') {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function isValidRut(rut) {
  const cleaned = String(rut).replace(/\./g, '').replace(/-/g, '').trim().toLowerCase();
  if (cleaned.length < 2) return false;
  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);
  if (!/^\d+$/.test(body)) return false;
  let sum = 0, m = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * m;
    m = m === 7 ? 2 : m + 1;
  }
  const mod = 11 - (sum % 11);
  const expected = mod === 11 ? '0' : mod === 10 ? 'k' : String(mod);
  return dv === expected;
}

const EMPTY_PATIENT_FORM = { rut: '', name: '', phone: '', email: '' };

export default function Bookings() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);

  const [linkModal, setLinkModal] = useState(null); // bookingId
  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState([]);
  const [newPatientForm, setNewPatientForm] = useState(EMPTY_PATIENT_FORM);
  const [showNewPatient, setShowNewPatient] = useState(false);
  const [linkSaving, setLinkSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/bookings', { params: { date } });
      setBookings(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [date]);

  const changeStatus = async (id, status) => {
    await api.patch(`/bookings/${id}/status`, { status });
    load();
  };

  const searchPatients = async (q) => {
    setPatientSearch(q);
    if (!q) { setPatientResults([]); return; }
    const { data } = await api.get('/patients', { params: { search: q, limit: 5 } });
    setPatientResults(data.patients);
  };

  const linkPatient = async (bookingId, patientId) => {
    setLinkSaving(true);
    try {
      await api.put(`/bookings/${bookingId}`, { patient_id: patientId });
    } catch {
      // bookings PUT may not exist yet — use PATCH status as workaround if needed
    }
    load();
    setLinkModal(null);
    setPatientSearch('');
    setPatientResults([]);
    setLinkSaving(false);
  };

  const createAndLink = async (bookingId) => {
    if (!isValidRut(newPatientForm.rut)) { alert('RUT inválido'); return; }
    setLinkSaving(true);
    try {
      const { data: p } = await api.post('/patients', { ...newPatientForm });
      await api.put(`/bookings/${bookingId}`, { patient_id: p.id });
      load();
      setLinkModal(null);
      setShowNewPatient(false);
      setNewPatientForm(EMPTY_PATIENT_FORM);
    } catch (err) {
      alert(err.response?.data?.error || 'Error');
    } finally {
      setLinkSaving(false);
    }
  };

  const formatTime = (iso) => new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  const confirmed = bookings.filter(b => b.status === 'confirmed').length;

  const inputClass = 'w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reservas</h1>
          <p className="text-slate-500 text-sm mt-0.5">Gestiona las citas de tu negocio</p>
        </div>
        <input
          type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="border border-slate-200 rounded-xl px-4 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500 mb-1">Total del día</p>
          <p className="text-3xl font-bold text-slate-900">{bookings.length}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500 mb-1">Confirmadas</p>
          <p className="text-3xl font-bold text-emerald-600">{confirmed}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500 mb-1">Con ficha</p>
          <p className="text-3xl font-bold text-indigo-600">{bookings.filter(b => b.patient_id).length}</p>
        </div>
      </div>

      {loading && <p className="text-slate-400 text-sm">Cargando...</p>}

      {!loading && bookings.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center shadow-sm">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-slate-400 text-sm">No hay reservas para este día</p>
        </div>
      )}

      <div className="space-y-3">
        {bookings.map((b) => (
          <div key={b.id} className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-4 shadow-sm">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 font-bold text-sm shrink-0">
              {initials(b.client_name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-900 text-sm">{b.client_name}</p>
              <p className="text-slate-400 text-xs">
                {b.service_name || 'Sin servicio'}{b.duration_min ? ` · ${b.duration_min} min` : ''}{b.client_phone ? ` · ${b.client_phone}` : ''}
              </p>
              {/* Patient link */}
              <div className="mt-1">
                {b.patient_name ? (
                  <button
                    onClick={() => navigate(`/dashboard/pacientes/${b.patient_id}`)}
                    className="text-xs text-indigo-600 hover:underline"
                  >
                    👤 {b.patient_name}
                  </button>
                ) : (
                  <button
                    onClick={() => { setLinkModal(b.id); setPatientSearch(''); setPatientResults([]); setShowNewPatient(false); }}
                    className="text-xs text-slate-400 hover:text-indigo-600 border border-dashed border-slate-200 px-2 py-0.5 rounded-lg"
                  >
                    Vincular paciente
                  </button>
                )}
              </div>
            </div>
            <div className="text-indigo-600 font-bold text-sm shrink-0">{formatTime(b.datetime_iso)}</div>
            <div className="flex items-center gap-2 shrink-0">
              {b.patient_id && (
                <button
                  onClick={() => navigate(`/dashboard/pacientes/${b.patient_id}`)}
                  className="text-xs border border-slate-200 px-2 py-1 rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  Nueva consulta
                </button>
              )}
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_LABELS[b.status]?.color}`}>
                {STATUS_LABELS[b.status]?.label || b.status}
              </span>
              <select
                value={b.status}
                onChange={(e) => changeStatus(b.id, e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1 text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
              >
                <option value="confirmed">Confirmada</option>
                <option value="completed">Completada</option>
                <option value="cancelled">Cancelada</option>
                <option value="no_show">No asistió</option>
              </select>
            </div>
          </div>
        ))}
      </div>

      {/* Link patient modal */}
      {linkModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Vincular paciente</h2>
            {!showNewPatient ? (
              <>
                <input
                  value={patientSearch}
                  onChange={e => searchPatients(e.target.value)}
                  placeholder="Buscar por nombre o RUT..."
                  className={`${inputClass} mb-3`}
                />
                {patientResults.map(p => (
                  <button
                    key={p.id}
                    onClick={() => linkPatient(linkModal, p.id)}
                    disabled={linkSaving}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-xl text-sm mb-1"
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="text-slate-400 text-xs ml-2 font-mono">{p.rut}</span>
                  </button>
                ))}
                {patientSearch && patientResults.length === 0 && (
                  <p className="text-slate-400 text-xs mb-3">No encontrado.</p>
                )}
                <button onClick={() => setShowNewPatient(true)} className="text-sm text-indigo-600 hover:underline mt-2">
                  + Crear nuevo paciente
                </button>
                <div className="mt-4">
                  <button onClick={() => setLinkModal(null)} className="w-full border border-slate-200 rounded-xl py-2 text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">RUT *</label>
                  <input value={newPatientForm.rut} onChange={e => setNewPatientForm({ ...newPatientForm, rut: e.target.value })} placeholder="12.345.678-9" className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre *</label>
                  <input value={newPatientForm.name} onChange={e => setNewPatientForm({ ...newPatientForm, name: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Teléfono</label>
                  <input value={newPatientForm.phone} onChange={e => setNewPatientForm({ ...newPatientForm, phone: e.target.value })} className={inputClass} />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowNewPatient(false)} className="flex-1 border border-slate-200 rounded-xl py-2 text-sm text-slate-600 hover:bg-slate-50">Atrás</button>
                  <button onClick={() => createAndLink(linkModal)} disabled={linkSaving || !newPatientForm.name} className="flex-1 bg-indigo-600 text-white rounded-xl py-2 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
                    {linkSaving ? 'Guardando...' : 'Crear y vincular'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

**Note:** The `linkPatient` function calls `PUT /api/bookings/:id` with `{ patient_id }`. The existing bookings routes only expose `PATCH /:id/status`. You need to add a `PUT /:id` route to `bookings.routes.js` and a `updateBooking` handler to the bookings controller. Add to `bookings.controller.js`:

```js
const updateBooking = (req, res) => {
  const booking = db.prepare('SELECT id FROM bookings WHERE id = ? AND business_id = ?').get(req.params.id, req.business.id);
  if (!booking) return res.status(404).json({ error: 'Reserva no encontrada' });
  const { patient_id } = req.body;
  if (patient_id !== undefined) {
    db.prepare('UPDATE bookings SET patient_id = ? WHERE id = ?').run(patient_id || null, req.params.id);
  }
  res.json(db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id));
};
```

And add to `bookings.routes.js`:
```js
router.put('/:id', auth, updateBooking);
```

And export `updateBooking` from the controller.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/Bookings.jsx backend/src/controllers/bookings.controller.js backend/src/routes/bookings.routes.js
git commit -m "feat(health): add patient column to bookings, link patient modal, new consultation button"
```

---

## Task 15: Create `frontend/src/pages/Professionals.jsx`

**Files:**
- Create: `frontend/src/pages/Professionals.jsx`

- [ ] **Step 1: Create the file**

```jsx
// frontend/src/pages/Professionals.jsx
import { useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const EMPTY_FORM = { name: '', specialty: '', email: '' };

export default function Professionals() {
  const { business } = useAuth();
  const [professionals, setProfessionals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const isPro = business?.plan === 'pro' || business?.plan === 'clinic';

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/professionals');
      setProfessionals(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (isPro) load(); }, [isPro]);

  if (!isPro) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="text-5xl mb-4">👥</div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Disponible en plan Pro</h2>
        <p className="text-slate-500 text-sm max-w-xs mb-6">Gestiona múltiples profesionales en tu consulta con el plan Pro o Clínica.</p>
        <button className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700">
          Actualizar plan
        </button>
      </div>
    );
  }

  const openNew = () => { setEditingId(null); setForm(EMPTY_FORM); setError(''); setShowModal(true); };
  const openEdit = (p) => { setEditingId(p.id); setForm({ name: p.name, specialty: p.specialty, email: p.email || '' }); setError(''); setShowModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editingId) {
        await api.put(`/professionals/${editingId}`, form);
      } else {
        await api.post('/professionals', form);
      }
      setShowModal(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!confirm('¿Eliminar este profesional?')) return;
    await api.delete(`/professionals/${id}`);
    load();
  };

  const inputClass = 'w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Profesionales</h1>
          <p className="text-slate-500 text-sm mt-0.5">Equipo de tu consulta</p>
        </div>
        <button onClick={openNew} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700">
          + Agregar profesional
        </button>
      </div>

      {loading && <p className="text-slate-400 text-sm">Cargando...</p>}

      {!loading && professionals.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center shadow-sm">
          <p className="text-4xl mb-3">👤</p>
          <p className="text-slate-400 text-sm">No hay profesionales registrados</p>
        </div>
      )}

      <div className="grid gap-3">
        {professionals.map(p => (
          <div key={p.id} className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-4 shadow-sm">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 font-bold text-sm shrink-0">
              {p.name[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-900 text-sm">{p.name}</p>
              <p className="text-slate-400 text-xs">{p.specialty}{p.email ? ` · ${p.email}` : ''}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => openEdit(p)} className="text-xs text-indigo-600 hover:underline">Editar</button>
              <button onClick={() => remove(p.id)} className="text-xs text-red-500 hover:underline">Eliminar</button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">{editingId ? 'Editar profesional' : 'Nuevo profesional'}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre *</label>
                <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Especialidad *</label>
                <input required value={form.specialty} onChange={e => setForm({ ...form, specialty: e.target.value })} className={inputClass} placeholder="Ej: Kinesiología" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={inputClass} />
              </div>
              {error && <p className="text-red-600 text-xs">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-slate-200 rounded-xl py-2 text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 bg-indigo-600 text-white rounded-xl py-2 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/Professionals.jsx
git commit -m "feat(health): add professionals page with plan gate"
```

---

## Task 16: Update `App.jsx`, `Layout.jsx`, and `BookingPage.jsx`

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/Layout.jsx`
- Modify: `frontend/src/pages/BookingPage.jsx`

- [ ] **Step 1: Update `frontend/src/App.jsx` — add new routes**

Replace the file:

```jsx
// frontend/src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Bookings from './pages/Bookings';
import Services from './pages/Services';
import Schedules from './pages/Schedules';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import BookingPage from './pages/BookingPage';
import Patients from './pages/Patients';
import PatientDetail from './pages/PatientDetail';
import Professionals from './pages/Professionals';

function Protected({ children }) {
  const { business } = useAuth();
  return business ? children : <Navigate to="/login" replace />;
}

function PublicOnly({ children }) {
  const { business } = useAuth();
  return business ? <Navigate to="/dashboard" replace /> : children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
          <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
          <Route path="/dashboard" element={<Protected><Layout><Bookings /></Layout></Protected>} />
          <Route path="/dashboard/servicios" element={<Protected><Layout><Services /></Layout></Protected>} />
          <Route path="/dashboard/horarios" element={<Protected><Layout><Schedules /></Layout></Protected>} />
          <Route path="/dashboard/analytics" element={<Protected><Layout><Analytics /></Layout></Protected>} />
          <Route path="/dashboard/configuracion" element={<Protected><Layout><Settings /></Layout></Protected>} />
          <Route path="/dashboard/pacientes" element={<Protected><Layout><Patients /></Layout></Protected>} />
          <Route path="/dashboard/pacientes/:id" element={<Protected><Layout><PatientDetail /></Layout></Protected>} />
          <Route path="/dashboard/profesionales" element={<Protected><Layout><Professionals /></Layout></Protected>} />
          <Route path="/book/:slug" element={<BookingPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
```

- [ ] **Step 2: Update `frontend/src/components/Layout.jsx` — add sidebar links**

Replace with:

```jsx
// frontend/src/components/Layout.jsx
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout({ children }) {
  const { business, logout } = useAuth();
  const navigate = useNavigate();

  const isPro = business?.plan === 'pro' || business?.plan === 'clinic';

  const handleLogout = () => { logout(); navigate('/login'); };

  const links = [
    { to: '/dashboard', label: 'Reservas', icon: '📅' },
    { to: '/dashboard/servicios', label: 'Servicios', icon: '🛠' },
    { to: '/dashboard/horarios', label: 'Horarios', icon: '🕐' },
    { to: '/dashboard/pacientes', label: 'Pacientes', icon: '👤' },
    ...(isPro ? [{ to: '/dashboard/profesionales', label: 'Profesionales', icon: '👥' }] : []),
    { to: '/dashboard/analytics', label: 'Analytics', icon: '📊' },
    { to: '/dashboard/configuracion', label: 'Configuración', icon: '⚙️' },
  ];

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-60 bg-slate-900 flex flex-col shrink-0">
        <div className="p-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              {business?.name?.[0]?.toUpperCase() || 'S'}
            </div>
            <span className="text-white font-semibold text-sm truncate">{business?.name || 'Dashboard'}</span>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {links.map(({ to, label, icon }) => (
            <NavLink
              key={to} to={to} end={to === '/dashboard'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`
              }
            >
              <span>{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-800 space-y-1">
          {business?.slug && (
            <a
              href={`/book/${business.slug}`}
              target="_blank" rel="noreferrer"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <span>🔗</span>
              Página pública
            </a>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <span>🚪</span>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 p-8 overflow-auto">
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Update `frontend/src/pages/BookingPage.jsx` — add RUT field**

In BookingPage.jsx, make the following targeted changes (do NOT rewrite the whole file, only the data-entry step):

**Change 1** — Add `client_rut` to the form state initialization. Find:
```js
const [form, setForm] = useState({ client_name: '', client_email: '', client_phone: '', notes: '' });
```
Change to:
```js
const [form, setForm] = useState({ client_name: '', client_email: '', client_phone: '', client_rut: '', notes: '' });
```

**Change 2** — Add the RUT validation helper after the imports:
```js
function isValidRut(rut) {
  const cleaned = String(rut).replace(/\./g, '').replace(/-/g, '').trim().toLowerCase();
  if (cleaned.length < 2) return false;
  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);
  if (!/^\d+$/.test(body)) return false;
  let sum = 0, m = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * m;
    m = m === 7 ? 2 : m + 1;
  }
  const mod = 11 - (sum % 11);
  const expected = mod === 11 ? '0' : mod === 10 ? 'k' : String(mod);
  return dv === expected;
}
```

**Change 3** — In `handleSubmit`, add `client_rut` to the POST body:
```js
await axios.post(`/api/bookings/public/${slug}`, {
  client_name: form.client_name,
  client_email: form.client_email || undefined,
  client_phone: form.client_phone || undefined,
  client_rut: form.client_rut || undefined,
  service_id: selectedService?.id,
  datetime_iso,
  notes: form.notes || undefined,
});
```

**Change 4** — In Step 4 (datos section), add RUT field after "Nombre completo" but BEFORE "Teléfono". The speciality comes from `profile.business.specialty`. Insert:

```jsx
{/* RUT field — required when business has a health specialty */}
{profile?.business?.specialty && profile.business.specialty !== 'general' && (
  <div>
    <label className="text-xs font-semibold text-slate-700">
      RUT *{' '}
      {form.client_rut.length > 2 && (
        isValidRut(form.client_rut)
          ? <span className="text-emerald-600 font-normal">✓ válido</span>
          : <span className="text-red-500 font-normal">inválido</span>
      )}
    </label>
    <input
      required value={form.client_rut}
      onChange={(e) => setForm({ ...form, client_rut: e.target.value })}
      placeholder="ej: 12.345.678-9"
      className={inputClass}
    />
  </div>
)}
```

**Change 5** — Update the submit button's disabled condition to also check RUT when required:
```jsx
disabled={submitting || !form.client_name || !form.client_phone ||
  (profile?.business?.specialty && profile.business.specialty !== 'general' && !isValidRut(form.client_rut))}
```

**Change 6** — Also reset `client_rut` in the "Agendar otra hora" reset:
```js
setForm({ client_name: '', client_email: '', client_phone: '', client_rut: '', notes: '' });
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.jsx frontend/src/components/Layout.jsx frontend/src/pages/BookingPage.jsx
git commit -m "feat(health): add patient/professional routes to sidebar and RUT field to public booking"
```

---

## Self-Review Checklist

### Spec coverage check

| Spec requirement | Covered in |
|---|---|
| `professionals` table | Task 2 |
| `patients` table | Task 2 |
| `consultations` table | Task 2 |
| `prescriptions` table | Task 2 |
| ALTER TABLE businesses specialty | Task 2 |
| ALTER TABLE bookings patient_id, professional_id, reminded | Task 2 |
| `src/lib/crypto.js` encrypt/decrypt | Task 1 |
| ENCRYPTION_KEY startup validation | Task 3 |
| GET/POST/PUT patients, history, export | Task 4 |
| 409 on duplicate RUT | Task 4 |
| No allergies/background in list | Task 4 ✓ (SELECT omits them) |
| GET/POST/PUT consultations | Task 5 |
| POST/GET prescriptions + PDF download | Task 6 |
| GET/POST/PUT/DELETE professionals | Task 7 |
| Public slots endpoint | Task 8 |
| specialty exposed in public profile | Task 8 |
| Register 4 new routes in index.js | Task 9 |
| specialty in register | Task 9, 11 |
| patient_name in bookings list | Task 9 |
| client_rut in public booking | Task 9, 16 |
| .env.example updated | Task 10 |
| Register.jsx specialty select | Task 11 |
| Patients.jsx list + search + modal | Task 12 |
| PatientDetail.jsx | Task 13 |
| Bookings.jsx patient column + link modal | Task 14 |
| PUT /api/bookings/:id for patient link | Task 14 |
| Professionals.jsx with plan gate | Task 15 |
| Layout.jsx sidebar links | Task 16 |
| App.jsx routes | Task 16 |
| BookingPage.jsx RUT field | Task 16 |
| WhatsApp integration | Already implemented in existing code |

### Placeholder scan
No TBDs found.

### Type/name consistency
- `patient_id` used consistently across DB, controllers, and frontend
- `encrypt`/`decrypt` from `../lib/crypto` imported identically in all 3 controllers
- `isValidRut` duplicated in 3 frontend files by design (no shared utils file exists; YAGNI)
- `req.business.id` pattern consistent with existing controllers
- `db.prepare(...).all(...)` / `.get(...)` / `.run(...)` consistent with existing code
