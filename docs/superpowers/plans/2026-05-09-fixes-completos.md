# Fixes Completos SaaS + Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolver los 3 bloqueantes críticos del SaaS, refactors importantes, consultations UI, merge del bot y conexión Fase 4.

**Architecture:** Fixes quirúrgicos sobre el stack existente (Express + SQLite + React). Sin nuevas abstracciones. El password reset usa nodemailer con SMTP configurable vía .env.

**Tech Stack:** Node.js 24, Express 4, node:sqlite, React 19, Vite 8, TailwindCSS 4, nodemailer

---

## Orden de ejecución

1. Fix doble-booking (backend)
2. Fix paginación reservas (backend + frontend)
3. Fix password reset (backend + frontend)
4. Refactor RUT validator duplicado (frontend)
5. Consultations list page (frontend)
6. Merge bot feat/fase-2 → main
7. Fase 4: bot → SaaS API

---

### Task 1: Fix doble-booking

**Files:**
- Modify: `backend/src/controllers/bookings.controller.js`

- [ ] **Agregar conflict check en `create` (admin) antes del INSERT**

En `create()`, justo antes del `db.prepare('INSERT INTO bookings...')`, agregar:

```js
const conflict = db.prepare(`
  SELECT id FROM bookings
  WHERE business_id = ? AND datetime_iso = ? AND status != 'cancelled'
`).get(req.business.id, datetime_iso);
if (conflict) return res.status(409).json({ error: 'Ese horario ya está reservado' });
```

- [ ] **Agregar conflict check en `publicCreate` también**

Justo antes del INSERT en `publicCreate()`:

```js
const conflict = db.prepare(`
  SELECT id FROM bookings
  WHERE business_id = ? AND datetime_iso = ? AND status != 'cancelled'
`).get(business.id, datetime_iso);
if (conflict) return res.status(409).json({ error: 'Ese horario ya no está disponible' });
```

- [ ] **Commit**

```bash
git add backend/src/controllers/bookings.controller.js
git commit -m "fix: validar doble-booking antes de insertar reserva"
```

---

### Task 2: Fix paginación reservas

**Files:**
- Modify: `backend/src/controllers/bookings.controller.js` (función `list`)
- Modify: `frontend/src/pages/Bookings.jsx`

- [ ] **Backend: reemplazar LIMIT 500 con paginación real**

Reemplazar la función `list` completa:

```js
const list = (req, res) => {
  const { date, status } = req.query;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
  const offset = (page - 1) * limit;

  let where = 'WHERE b.business_id = ?';
  const params = [req.business.id];

  if (date) {
    if (!DATE_RE.test(date)) return res.status(400).json({ error: 'formato de fecha inválido (YYYY-MM-DD)' });
    where += ' AND date(b.datetime_iso) = ?';
    params.push(date);
  }
  if (status) {
    if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: `status debe ser uno de: ${VALID_STATUSES.join(', ')}` });
    where += ' AND b.status = ?';
    params.push(status);
  }

  const total = db.prepare(`
    SELECT COUNT(*) as n FROM bookings b ${where}
  `).get(...params).n;

  const bookings = db.prepare(`
    SELECT b.*, s.name as service_name, s.duration_min, p.name as patient_name, p.rut as patient_rut
    FROM bookings b
    LEFT JOIN services s ON b.service_id = s.id
    LEFT JOIN patients p ON b.patient_id = p.id
    ${where}
    ORDER BY b.datetime_iso ASC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  res.json({ bookings, total, page, pages: Math.ceil(total / limit) });
};
```

- [ ] **Frontend Bookings.jsx: adaptar al nuevo formato de respuesta**

Cambiar `setBookings(data)` por `setBookings(data.bookings)` en el `load()`.

- [ ] **Commit**

```bash
git add backend/src/controllers/bookings.controller.js frontend/src/pages/Bookings.jsx
git commit -m "feat: paginación en listado de reservas (page/limit/total)"
```

---

### Task 3: Password Reset — Backend

**Files:**
- Modify: `backend/src/db/database.js`
- Modify: `backend/src/controllers/auth.controller.js`
- Modify: `backend/src/routes/auth.routes.js`
- Modify: `backend/.env.example`

- [ ] **Instalar nodemailer**

```bash
cd backend && npm install nodemailer
```

- [ ] **database.js: agregar columnas reset_token**

Agregar al bloque de ALTER TABLE al final:

```js
"ALTER TABLE businesses ADD COLUMN reset_token TEXT",
"ALTER TABLE businesses ADD COLUMN reset_token_expires TEXT"
```

- [ ] **auth.controller.js: agregar forgotPassword y resetPassword**

Al final del archivo, antes de `module.exports`:

```js
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

  // Siempre responder OK para no revelar si el email existe
  if (!business) return res.json({ ok: true });

  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hora

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
```

- [ ] **auth.routes.js: agregar rutas**

```js
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
```

Y en el import al inicio:
```js
const { register, login, me, forgotPassword, resetPassword } = require('../controllers/auth.controller');
```

- [ ] **.env.example: agregar vars SMTP**

```
# ── Recuperación de contraseña (SMTP) ────────────────────────────────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu@gmail.com
SMTP_PASS=tu_app_password_gmail
```

- [ ] **Commit**

```bash
git add backend/
git commit -m "feat: recuperación de contraseña con email SMTP (nodemailer)"
```

---

### Task 4: Password Reset — Frontend

**Files:**
- Create: `frontend/src/pages/ForgotPassword.jsx`
- Create: `frontend/src/pages/ResetPassword.jsx`
- Modify: `frontend/src/pages/Login.jsx`
- Modify: `frontend/src/App.jsx`

- [ ] **Crear ForgotPassword.jsx**

```jsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/forgot-password', { owner_email: email });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al enviar email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-8">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center text-white text-sm">📅</div>
          <span className="font-bold text-slate-900">AgendaSaaS</span>
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-1">Recuperar contraseña</h2>
        <p className="text-slate-500 text-sm mb-8">Te enviaremos un enlace para restablecer tu contraseña.</p>

        {sent ? (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl px-4 py-4">
            Si el email está registrado, recibirás un enlace en tu correo.
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <input
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                placeholder="tu@email.com"
              />
            </div>
            {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}
            <button
              type="submit" disabled={loading}
              className="w-full bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Enviando...' : 'Enviar enlace'}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-slate-500 mt-6">
          <Link to="/login" className="text-indigo-600 hover:underline font-medium">Volver al login</Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Crear ResetPassword.jsx**

```jsx
import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import api from '../api/client';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return; }
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/reset-password', { token: params.get('token'), password });
      navigate('/login', { state: { msg: 'Contraseña restablecida. Inicia sesión.' } });
    } catch (err) {
      setError(err.response?.data?.error || 'Error al restablecer contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-8">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center text-white text-sm">📅</div>
          <span className="font-bold text-slate-900">AgendaSaaS</span>
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-1">Nueva contraseña</h2>
        <p className="text-slate-500 text-sm mb-8">Elige una contraseña de al menos 8 caracteres.</p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Nueva contraseña</label>
            <input
              type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirmar contraseña</label>
            <input
              type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
            />
          </div>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}
          <button
            type="submit" disabled={loading}
            className="w-full bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Guardando...' : 'Guardar contraseña'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          <Link to="/login" className="text-indigo-600 hover:underline font-medium">Volver al login</Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Login.jsx: agregar link "¿Olvidaste tu contraseña?"**

Debajo del campo password, antes del error block, agregar:
```jsx
<div className="flex justify-end">
  <Link to="/forgot-password" className="text-xs text-indigo-600 hover:underline">¿Olvidaste tu contraseña?</Link>
</div>
```

Y mostrar el mensaje de estado si viene de reset:
```jsx
const location = useLocation();
// agregar 'useLocation' al import de react-router-dom
```

- [ ] **App.jsx: agregar rutas**

```jsx
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword  from './pages/ResetPassword';
// En Routes:
<Route path="/forgot-password" element={<PublicOnly><ForgotPassword /></PublicOnly>} />
<Route path="/reset-password"  element={<PublicOnly><ResetPassword /></PublicOnly>} />
```

- [ ] **Commit**

```bash
git add frontend/src/
git commit -m "feat: páginas de recuperación de contraseña (forgot/reset)"
```

---

### Task 5: Refactor RUT validator

**Files:**
- Create: `frontend/src/utils/rut.js`
- Modify: `frontend/src/pages/BookingPage.jsx`
- Modify: `frontend/src/pages/Bookings.jsx`
- Modify: `frontend/src/pages/Patients.jsx`

- [ ] **Crear src/utils/rut.js**

```js
export function isValidRut(rut) {
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

- [ ] **Actualizar los 3 archivos**: eliminar la función local `isValidRut` e importar desde utils.

- [ ] **Commit**

```bash
git add frontend/src/
git commit -m "refactor: extraer isValidRut a src/utils/rut.js"
```

---

### Task 6: Consultations list page

**Files:**
- Create: `frontend/src/pages/Consultations.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/config/verticals.config.js`

- [ ] **Crear Consultations.jsx** — lista de todas las consultas con filtro de fecha
- [ ] **Agregar ruta en App.jsx**: `/dashboard/consultas`
- [ ] **Agregar módulo en verticals.config.js** (solo vertical salud)
- [ ] **Commit**

```bash
git add frontend/src/
git commit -m "feat: página de listado de consultas médicas"
```

---

### Task 7: Merge bot feat/fase-2 → main

- [ ] **Checkout main y merge**

```bash
cd C:\Users\Lenovo\whatsapp-bot
git checkout main
git merge feat/fase-2 --no-ff -m "chore: merge feat/fase-2 — Fase 2 completa (fixes + AI memory + alerts)"
```

---

### Task 8: Fase 4 — Bot → SaaS API

**Files:**
- Modify: `C:\Users\Lenovo\whatsapp-bot\src\handlers\booking.handler.js`
- Modify: `C:\Users\Lenovo\whatsapp-bot\clients\workly\config.js`

- [ ] **config.js: agregar slug de Workly**

```js
slug: 'workly',  // debe coincidir con el slug del negocio en el SaaS
```

- [ ] **booking.handler.js: POST al SaaS al confirmar**

En el case `'CONFIRM'`, después de `saveBooking.run(...)`, agregar:

```js
// Si SAAS_URL y config.slug están configurados, registrar también en el SaaS
const saasUrl = process.env.SAAS_URL
if (saasUrl && config.slug) {
  fetch(`${saasUrl}/api/bookings/public/${config.slug}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: ctx.name,
      client_email: ctx.clientEmail,
      client_phone: phone,
      service_id: null,
      datetime_iso: ctx.datetimeISO,
      source: 'whatsapp',
    }),
  }).catch(err => console.warn('[booking] Error sincronizando con SaaS:', err.message))
}
```

- [ ] **Commit**

```bash
cd C:\Users\Lenovo\whatsapp-bot
git add src/handlers/booking.handler.js clients/workly/config.js
git commit -m "feat: Fase 4 — sincronizar reservas del bot con API del SaaS"
```
