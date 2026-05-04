# SaaS Mejoras: Email + Analytics + Settings — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar las 3 funcionalidades más demandadas en SaaS de agendamiento 2026: (A) confirmaciones por email + recordatorios automáticos 24h antes, (B) dashboard de analytics con gráficas, y (C) página de configuración del perfil del negocio.

**Architecture:** Tres features completamente independientes implementables en cualquier orden. Feature A usa Resend SDK para emails transaccionales y node-cron para el scheduler. Feature B agrega un endpoint de agregación SQL en el backend y visualiza con Recharts en React. Feature C extiende el schema `businesses` con columna `description` y expone endpoints protegidos GET/PUT.

**Tech Stack:** Node.js/Express, better-sqlite3, Resend SDK, node-cron, React 19, Recharts, Tailwind CSS v4

---

> ⚠️ **Subsistemas independientes:** Implementa cada feature por separado. Orden recomendado: A → C → B.

---

## File Map

### Feature A — Email Confirmaciones + Recordatorios

| Acción | Archivo |
|--------|---------|
| Instalar | `resend`, `node-cron` en backend |
| Crear | `backend/src/services/email.js` |
| Crear | `backend/src/jobs/reminders.js` |
| Modificar | `backend/src/db/database.js` — añadir columna `reminder_sent` |
| Modificar | `backend/src/controllers/bookings.controller.js` — llamar email en `publicCreate` |
| Modificar | `backend/src/index.js` — iniciar cron job |
| Modificar | `backend/.env.example` — añadir `RESEND_API_KEY` |

### Feature B — Analytics Dashboard

| Acción | Archivo |
|--------|---------|
| Instalar | `recharts` en frontend |
| Crear | `backend/src/routes/analytics.routes.js` |
| Crear | `backend/src/controllers/analytics.controller.js` |
| Modificar | `backend/src/index.js` — montar analytics routes |
| Crear | `frontend/src/pages/Analytics.jsx` |
| Modificar | `frontend/src/components/Layout.jsx` — añadir link al sidebar |
| Modificar | `frontend/src/App.jsx` — añadir ruta `/dashboard/analytics` |

### Feature C — Settings de Perfil

| Acción | Archivo |
|--------|---------|
| Crear | `backend/src/routes/settings.routes.js` |
| Crear | `backend/src/controllers/settings.controller.js` |
| Modificar | `backend/src/db/database.js` — añadir columna `description` a businesses |
| Modificar | `backend/src/index.js` — montar settings routes |
| Crear | `frontend/src/pages/Settings.jsx` |
| Modificar | `frontend/src/components/Layout.jsx` — añadir link al sidebar |
| Modificar | `frontend/src/App.jsx` — añadir ruta `/dashboard/configuracion` |

---

## ═══════════════════════════════════
## FEATURE A: Email + Recordatorios
## ═══════════════════════════════════

### Task 1: Instalar dependencias de email y cron

**Files:**
- Modify: `backend/package.json` (via npm install)

- [ ] **Step 1: Instalar paquetes**

```bash
cd backend && npm install resend node-cron
```

Expected output: `added X packages`

- [ ] **Step 2: Verificar instalación**

```bash
node -e "require('resend'); require('node-cron'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Obtener API key de Resend**

Ve a https://resend.com → Sign up (gratis) → API Keys → Create API Key.

> **IMPORTANTE:** En el plan gratuito solo puedes enviar desde `onboarding@resend.dev`. Para usar tu propio dominio debes verificarlo en Resend. Para desarrollo/testing usa `onboarding@resend.dev`.

- [ ] **Step 4: Añadir variable al .env y .env.example**

En `backend/.env` añadir:
```
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=onboarding@resend.dev
```

En `backend/.env.example` añadir al final:
```
RESEND_API_KEY=re_your_api_key_here
EMAIL_FROM=onboarding@resend.dev
```

- [ ] **Step 5: Commit**

```bash
cd backend && git add package.json package-lock.json .env.example
git commit -m "feat: add resend and node-cron dependencies for email"
```

---

### Task 2: Crear servicio de email con templates

**Files:**
- Create: `backend/src/services/email.js`

- [ ] **Step 1: Crear el archivo**

Crear `backend/src/services/email.js` con este contenido:

```js
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev';

const DAYS_ES = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

function formatDatetime(isoString) {
  const d = new Date(isoString);
  return `${DAYS_ES[d.getDay()]} ${d.getDate()} de ${MONTHS_ES[d.getMonth()]} a las ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function confirmationHtml({ clientName, serviceName, datetimeISO, businessName }) {
  const dateStr = formatDatetime(datetimeISO);
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:auto;color:#1e293b">
      <div style="background:#6366f1;padding:24px 32px;border-radius:12px 12px 0 0">
        <h1 style="margin:0;color:#fff;font-size:20px">✅ Reserva confirmada</h1>
      </div>
      <div style="background:#fff;padding:28px 32px;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 12px 12px">
        <p>Hola <strong>${clientName}</strong>,</p>
        <p>Tu cita en <strong>${businessName}</strong> ha sido agendada:</p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0">
          <tr style="background:#f8fafc">
            <td style="padding:10px 14px;font-weight:600;border-bottom:1px solid #e2e8f0;width:40%">Servicio</td>
            <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0">${serviceName}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px;font-weight:600">Fecha y hora</td>
            <td style="padding:10px 14px">${dateStr}</td>
          </tr>
        </table>
        <p style="color:#64748b;font-size:13px">Para cancelar o reagendar, contacta directamente al negocio.</p>
      </div>
    </div>
  `;
}

function reminderHtml({ clientName, serviceName, datetimeISO, businessName }) {
  const dateStr = formatDatetime(datetimeISO);
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:auto;color:#1e293b">
      <div style="background:#f59e0b;padding:24px 32px;border-radius:12px 12px 0 0">
        <h1 style="margin:0;color:#fff;font-size:20px">⏰ Recordatorio de tu cita</h1>
      </div>
      <div style="background:#fff;padding:28px 32px;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 12px 12px">
        <p>Hola <strong>${clientName}</strong>,</p>
        <p>Te recordamos que <strong>mañana</strong> tienes una cita en <strong>${businessName}</strong>:</p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0">
          <tr style="background:#f8fafc">
            <td style="padding:10px 14px;font-weight:600;border-bottom:1px solid #e2e8f0;width:40%">Servicio</td>
            <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0">${serviceName}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px;font-weight:600">Fecha y hora</td>
            <td style="padding:10px 14px">${dateStr}</td>
          </tr>
        </table>
        <p style="color:#64748b;font-size:13px">¡Te esperamos!</p>
      </div>
    </div>
  `;
}

async function sendConfirmation({ clientName, clientEmail, serviceName, datetimeISO, businessName }) {
  if (!process.env.RESEND_API_KEY || !clientEmail) return;
  await resend.emails.send({
    from: FROM,
    to: clientEmail,
    subject: `✅ Reserva confirmada — ${businessName}`,
    html: confirmationHtml({ clientName, serviceName, datetimeISO, businessName })
  });
}

async function sendReminder({ clientName, clientEmail, serviceName, datetimeISO, businessName }) {
  if (!process.env.RESEND_API_KEY || !clientEmail) return;
  await resend.emails.send({
    from: FROM,
    to: clientEmail,
    subject: `⏰ Recordatorio: tu cita es mañana — ${businessName}`,
    html: reminderHtml({ clientName, serviceName, datetimeISO, businessName })
  });
}

module.exports = { sendConfirmation, sendReminder };
```

- [ ] **Step 2: Verificar que el módulo carga**

```bash
cd backend && node -e "const e = require('./src/services/email'); console.log(Object.keys(e))"
```

Expected: `[ 'sendConfirmation', 'sendReminder' ]`

- [ ] **Step 3: Commit**

```bash
git add src/services/email.js
git commit -m "feat: add email service with confirmation and reminder templates"
```

---

### Task 3: Agregar columna reminder_sent a la base de datos

**Files:**
- Modify: `backend/src/db/database.js`

- [ ] **Step 1: Leer el archivo actual**

Abrir `backend/src/db/database.js` y localizar el bloque donde se crean las tablas (la línea que contiene `CREATE TABLE IF NOT EXISTS bookings`).

- [ ] **Step 2: Añadir migración después de la creación de tablas**

Justo después del bloque de `db.exec(...)` que crea todas las tablas, añadir:

```js
// Migrations — add columns if they don't exist yet
['ALTER TABLE bookings ADD COLUMN reminder_sent INTEGER DEFAULT 0'].forEach(sql => {
  try { db.exec(sql); } catch (_) { /* column already exists */ }
});
```

- [ ] **Step 3: Verificar que el servidor arranca sin error**

```bash
cd backend && npm start
```

Expected: servidor arranca, no hay error de SQLite.

Parar con Ctrl+C.

- [ ] **Step 4: Verificar que la columna existe**

```bash
node -e "
const db = require('./src/db/database');
const info = db.prepare('PRAGMA table_info(bookings)').all();
console.log(info.map(c => c.name));
"
```

Expected: el array incluye `'reminder_sent'`

- [ ] **Step 5: Commit**

```bash
git add src/db/database.js
git commit -m "feat: add reminder_sent column to bookings table"
```

---

### Task 4: Integrar confirmación por email en publicCreate

**Files:**
- Modify: `backend/src/controllers/bookings.controller.js`

- [ ] **Step 1: Leer bookings.controller.js**

Abrir `backend/src/controllers/bookings.controller.js` y localizar la función `publicCreate`. Encontrar la sección donde se llama `notifyBooking` del servicio de WhatsApp (aproximadamente después de guardar la reserva).

- [ ] **Step 2: Añadir import del email service**

Al inicio del archivo, junto al import de whatsapp, añadir:

```js
const { sendConfirmation } = require('../services/email');
```

- [ ] **Step 3: Llamar sendConfirmation en publicCreate**

Justo después de la línea que llama a `notifyBooking(...)` (o donde se crea la reserva exitosamente), añadir:

```js
sendConfirmation({
  clientName: client_name,
  clientEmail: client_email,
  serviceName: service.name,
  datetimeISO: datetime_iso,
  businessName: business.name
}).catch(err => console.error('[email:confirmation]', err.message));
```

- [ ] **Step 4: Reiniciar backend y probar**

```bash
cd backend && npm start
```

En otra terminal, crear una reserva pública usando la página `/book/:slug` con un email real tuyo. Verificar que recibes el email de confirmación.

- [ ] **Step 5: Commit**

```bash
git add src/controllers/bookings.controller.js
git commit -m "feat: send email confirmation on public booking creation"
```

---

### Task 5: Crear cron job de recordatorios 24h

**Files:**
- Create: `backend/src/jobs/reminders.js`
- Modify: `backend/src/index.js`

- [ ] **Step 1: Crear el directorio jobs**

```bash
mkdir -p backend/src/jobs
```

- [ ] **Step 2: Crear backend/src/jobs/reminders.js**

```js
const cron = require('node-cron');
const db = require('../db/database');
const { sendReminder } = require('../services/email');

function startReminderJob() {
  // Corre cada hora en el minuto 0
  cron.schedule('0 * * * *', async () => {
    const now = new Date();
    // Ventana: citas entre 23h y 25h desde ahora
    const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000).toISOString();
    const windowEnd   = new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString();

    const bookings = db.prepare(`
      SELECT b.id, b.client_name, b.client_email, b.datetime_iso,
             s.name  AS service_name,
             bi.name AS business_name
      FROM   bookings b
      JOIN   services    s  ON b.service_id  = s.id
      JOIN   businesses  bi ON b.business_id = bi.id
      WHERE  b.status         = 'confirmed'
        AND  b.reminder_sent  = 0
        AND  b.client_email  IS NOT NULL
        AND  b.client_email  != ''
        AND  b.datetime_iso  >= ?
        AND  b.datetime_iso  <= ?
    `).all(windowStart, windowEnd);

    for (const booking of bookings) {
      try {
        await sendReminder({
          clientName:   booking.client_name,
          clientEmail:  booking.client_email,
          serviceName:  booking.service_name,
          datetimeISO:  booking.datetime_iso,
          businessName: booking.business_name
        });
        db.prepare(`UPDATE bookings SET reminder_sent = 1 WHERE id = ?`).run(booking.id);
        console.log(`[reminder] OK → ${booking.client_email} (booking ${booking.id})`);
      } catch (err) {
        console.error(`[reminder] FAIL booking ${booking.id}:`, err.message);
      }
    }
  });

  console.log('[cron] Reminder job started — checks every hour');
}

module.exports = { startReminderJob };
```

- [ ] **Step 3: Modificar backend/src/index.js para arrancar el cron**

Abrir `backend/src/index.js`. Al final del archivo, antes o después del `app.listen(...)`, añadir:

```js
const { startReminderJob } = require('./jobs/reminders');
startReminderJob();
```

- [ ] **Step 4: Verificar que el servidor arranca con el cron activo**

```bash
cd backend && npm start
```

Expected en los logs: `[cron] Reminder job started — checks every hour`

- [ ] **Step 5: Probar el cron manualmente (smoke test)**

Crear una reserva en la base de datos con `datetime_iso` en 24h desde ahora y `client_email` real, luego forzar la ejecución:

```bash
node -e "
process.env.RESEND_API_KEY = require('dotenv').config().parsed.RESEND_API_KEY;
const { startReminderJob } = require('./src/jobs/reminders');
// Forzar ejecución inmediata para testing
const cron = require('node-cron');
" 
```

> Para test rápido: insertar una reserva manualmente con datetime = ahora+24h en SQLite y revisar logs.

- [ ] **Step 6: Commit**

```bash
git add src/jobs/reminders.js src/index.js
git commit -m "feat: add automated 24h reminder cron job via email"
```

---

## ═══════════════════════════════════
## FEATURE C: Settings de Perfil
## ═══════════════════════════════════

### Task 6: Agregar columna description al schema de businesses

**Files:**
- Modify: `backend/src/db/database.js`

- [ ] **Step 1: Ampliar el bloque de migrations en database.js**

En el array de migrations que creaste en Task 3, añadir la nueva migración:

```js
[
  'ALTER TABLE bookings    ADD COLUMN reminder_sent INTEGER DEFAULT 0',
  "ALTER TABLE businesses  ADD COLUMN description  TEXT    DEFAULT ''"
].forEach(sql => {
  try { db.exec(sql); } catch (_) { /* column already exists */ }
});
```

- [ ] **Step 2: Verificar**

```bash
cd backend && node -e "
const db = require('./src/db/database');
const info = db.prepare('PRAGMA table_info(businesses)').all();
console.log(info.map(c => c.name));
"
```

Expected: el array incluye `'description'`

- [ ] **Step 3: Commit**

```bash
git add src/db/database.js
git commit -m "feat: add description column to businesses table"
```

---

### Task 7: Crear settings controller

**Files:**
- Create: `backend/src/controllers/settings.controller.js`

- [ ] **Step 1: Crear el archivo**

```js
// backend/src/controllers/settings.controller.js
const db = require('../db/database');

function getProfile(req, res) {
  const { id } = req.business;
  const business = db.prepare(
    `SELECT id, name, owner_email, phone, description, slug, plan, created_at
     FROM businesses WHERE id = ?`
  ).get(id);
  if (!business) return res.status(404).json({ error: 'Negocio no encontrado' });
  res.json(business);
}

function updateProfile(req, res) {
  const { id } = req.business;
  const { name, phone, description } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'El nombre del negocio es requerido' });
  }
  db.prepare(
    `UPDATE businesses SET name = ?, phone = ?, description = ? WHERE id = ?`
  ).run(name.trim(), phone?.trim() || '', description?.trim() || '', id);

  const updated = db.prepare(
    `SELECT id, name, owner_email, phone, description, slug, plan FROM businesses WHERE id = ?`
  ).get(id);
  res.json(updated);
}

module.exports = { getProfile, updateProfile };
```

- [ ] **Step 2: Verificar que el módulo carga**

```bash
cd backend && node -e "const s = require('./src/controllers/settings.controller'); console.log(Object.keys(s))"
```

Expected: `[ 'getProfile', 'updateProfile' ]`

- [ ] **Step 3: Commit**

```bash
git add src/controllers/settings.controller.js
git commit -m "feat: add settings controller with getProfile and updateProfile"
```

---

### Task 8: Crear settings routes y montar en Express

**Files:**
- Create: `backend/src/routes/settings.routes.js`
- Modify: `backend/src/index.js`

- [ ] **Step 1: Crear backend/src/routes/settings.routes.js**

```js
const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { getProfile, updateProfile } = require('../controllers/settings.controller');

router.get('/profile', auth, getProfile);
router.put('/profile', auth, updateProfile);

module.exports = router;
```

- [ ] **Step 2: Montar las rutas en backend/src/index.js**

Abrir `backend/src/index.js`. Localizar donde se montan las demás rutas (e.g. `app.use('/api/bookings', ...)`). Añadir:

```js
const settingsRoutes = require('./routes/settings.routes');
app.use('/api/settings', settingsRoutes);
```

- [ ] **Step 3: Probar los endpoints manualmente**

```bash
cd backend && npm start
```

En otra terminal (obtener token JWT logueándote primero):

```bash
# GET profile
curl -H "Authorization: Bearer TU_TOKEN" http://localhost:3001/api/settings/profile
```

Expected: JSON con los datos del negocio incluyendo `description: ""`

```bash
# PUT profile
curl -X PUT http://localhost:3001/api/settings/profile \
  -H "Authorization: Bearer TU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Mi Negocio Updated","phone":"+56912345678","description":"Somos un negocio de ejemplo"}'
```

Expected: JSON con los datos actualizados.

- [ ] **Step 4: Commit**

```bash
git add src/routes/settings.routes.js src/index.js
git commit -m "feat: add settings routes GET/PUT /api/settings/profile"
```

---

### Task 9: Crear página Settings.jsx en el frontend

**Files:**
- Create: `frontend/src/pages/Settings.jsx`

- [ ] **Step 1: Crear el archivo**

```jsx
// frontend/src/pages/Settings.jsx
import { useState, useEffect, useContext } from 'react';
import api from '../api/client';
import { AuthContext } from '../context/AuthContext';

export default function Settings() {
  const { business } = useContext(AuthContext);
  const [form, setForm]   = useState({ name: '', phone: '', description: '' });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState('');
  const [copied, setCopied]   = useState(false);

  const publicUrl = `${window.location.origin}/book/${business?.slug}`;

  useEffect(() => {
    api.get('/settings/profile').then(r => {
      setForm({
        name:        r.data.name        || '',
        phone:       r.data.phone       || '',
        description: r.data.description || ''
      });
    });
  }, []);

  function handleCopy() {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSaved(false);
    try {
      await api.put('/settings/profile', form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar los cambios');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Configuración</h1>

      {/* Public URL */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-6">
        <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-2">
          Tu página pública de reservas
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-sm text-indigo-900 bg-white border border-indigo-200 rounded-lg px-3 py-2 truncate">
            {publicUrl}
          </code>
          <button
            onClick={handleCopy}
            className="shrink-0 text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            {copied ? '✓ Copiado' : 'Copiar'}
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Nombre del negocio <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
          <input
            type="text"
            value={business?.owner_email || ''}
            disabled
            className="w-full border border-slate-200 bg-slate-50 text-slate-400 rounded-lg px-3 py-2 text-sm cursor-not-allowed"
          />
          <p className="text-xs text-slate-400 mt-1">El email no se puede modificar.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
          <input
            type="text"
            value={form.phone}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            placeholder="+56 9 1234 5678"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Descripción del negocio</label>
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Describe brevemente tu negocio para los clientes..."
            rows={3}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
          <p className="text-xs text-slate-400 mt-1">Se mostrará en tu página pública de reservas.</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}
        {saved && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg px-4 py-3">
            ✓ Cambios guardados correctamente
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd frontend && git add src/pages/Settings.jsx
git commit -m "feat: add Settings page with profile form and public URL copy"
```

---

### Task 10: Agregar Settings al sidebar y al router

**Files:**
- Modify: `frontend/src/components/Layout.jsx`
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Leer Layout.jsx**

Abrir `frontend/src/components/Layout.jsx` y localizar el array o los elementos del menú lateral (los links a "Reservas", "Servicios", "Horarios").

- [ ] **Step 2: Añadir link de Configuración**

En el mismo bloque donde están los otros nav links, añadir Configuración antes de "Página pública":

```jsx
<NavLink to="/dashboard/configuracion" icon="⚙️" label="Configuración" />
```

> Usa el mismo componente/patrón que usan los otros links existentes en Layout.jsx.

- [ ] **Step 3: Leer App.jsx y añadir la ruta**

Abrir `frontend/src/App.jsx`. Localizar donde están las rutas protegidas. Añadir:

```jsx
import Settings from './pages/Settings';
// ...dentro de las rutas protegidas:
<Route path="/dashboard/configuracion" element={<Settings />} />
```

- [ ] **Step 4: Probar en el navegador**

```bash
cd frontend && npm run dev
```

Abrir http://localhost:5173/dashboard/configuracion. Verificar:
- [ ] El link "Configuración" aparece en el sidebar con el ícono ⚙️
- [ ] La página carga con los datos del negocio pre-rellenados
- [ ] El botón "Copiar" copia la URL pública al clipboard
- [ ] Al editar y guardar, aparece el mensaje verde de éxito

- [ ] **Step 5: Commit**

```bash
git add src/components/Layout.jsx src/App.jsx
git commit -m "feat: add Settings link to sidebar and route"
```

---

## ═══════════════════════════════════
## FEATURE B: Analytics Dashboard
## ═══════════════════════════════════

### Task 11: Crear analytics controller con queries SQL

**Files:**
- Create: `backend/src/controllers/analytics.controller.js`

- [ ] **Step 1: Crear el archivo**

```js
// backend/src/controllers/analytics.controller.js
const db = require('../db/database');

function getOverview(req, res) {
  const { id: business_id } = req.business;

  // Reservas por día, últimos 28 días (excl. canceladas)
  const bookingsByDay = db.prepare(`
    SELECT date(datetime_iso) AS day, COUNT(*) AS count
    FROM   bookings
    WHERE  business_id = ?
      AND  datetime_iso >= datetime('now', '-28 days')
      AND  status != 'cancelled'
    GROUP  BY day
    ORDER  BY day
  `).all(business_id);

  // Top 5 servicios más reservados (todos los tiempos)
  const topServices = db.prepare(`
    SELECT s.name, COUNT(*) AS count
    FROM   bookings b
    JOIN   services s ON b.service_id = s.id
    WHERE  b.business_id = ? AND b.status != 'cancelled'
    GROUP  BY s.id
    ORDER  BY count DESC
    LIMIT  5
  `).all(business_id);

  // Ingresos este mes (confirmadas + completadas)
  const { revenue: revenueThisMonth } = db.prepare(`
    SELECT COALESCE(SUM(s.price), 0) AS revenue
    FROM   bookings b
    JOIN   services s ON b.service_id = s.id
    WHERE  b.business_id = ?
      AND  strftime('%Y-%m', b.datetime_iso) = strftime('%Y-%m', 'now')
      AND  b.status IN ('confirmed','completed')
  `).get(business_id);

  // Clientes únicos (por email)
  const { total: totalClients } = db.prepare(`
    SELECT COUNT(DISTINCT client_email) AS total
    FROM   bookings
    WHERE  business_id   = ?
      AND  client_email IS NOT NULL
      AND  client_email != ''
  `).get(business_id);

  // Reservas este mes vs mes pasado
  const { count: thisMonthCount } = db.prepare(`
    SELECT COUNT(*) AS count FROM bookings
    WHERE  business_id = ?
      AND  strftime('%Y-%m', datetime_iso) = strftime('%Y-%m', 'now')
      AND  status != 'cancelled'
  `).get(business_id);

  const { count: lastMonthCount } = db.prepare(`
    SELECT COUNT(*) AS count FROM bookings
    WHERE  business_id = ?
      AND  strftime('%Y-%m', datetime_iso) = strftime('%Y-%m', datetime('now', '-1 month'))
      AND  status != 'cancelled'
  `).get(business_id);

  // Distribución por estado este mes
  const statusBreakdown = db.prepare(`
    SELECT status, COUNT(*) AS count
    FROM   bookings
    WHERE  business_id = ?
      AND  strftime('%Y-%m', datetime_iso) = strftime('%Y-%m', 'now')
    GROUP  BY status
  `).all(business_id);

  res.json({
    bookingsByDay,
    topServices,
    revenueThisMonth,
    totalClients,
    thisMonthCount,
    lastMonthCount,
    statusBreakdown
  });
}

module.exports = { getOverview };
```

- [ ] **Step 2: Verificar que el módulo carga**

```bash
cd backend && node -e "const a = require('./src/controllers/analytics.controller'); console.log(Object.keys(a))"
```

Expected: `[ 'getOverview' ]`

- [ ] **Step 3: Commit**

```bash
git add src/controllers/analytics.controller.js
git commit -m "feat: add analytics controller with SQL aggregations"
```

---

### Task 12: Crear analytics routes y montar en Express

**Files:**
- Create: `backend/src/routes/analytics.routes.js`
- Modify: `backend/src/index.js`

- [ ] **Step 1: Crear backend/src/routes/analytics.routes.js**

```js
const express  = require('express');
const router   = express.Router();
const auth     = require('../middleware/auth');
const { getOverview } = require('../controllers/analytics.controller');

router.get('/overview', auth, getOverview);

module.exports = router;
```

- [ ] **Step 2: Montar en backend/src/index.js**

Junto a los demás `app.use('/api/...')`, añadir:

```js
const analyticsRoutes = require('./routes/analytics.routes');
app.use('/api/analytics', analyticsRoutes);
```

- [ ] **Step 3: Probar el endpoint**

```bash
cd backend && npm start
```

```bash
curl -H "Authorization: Bearer TU_TOKEN" http://localhost:3001/api/analytics/overview
```

Expected: JSON con `bookingsByDay`, `topServices`, `revenueThisMonth`, `totalClients`, `thisMonthCount`, `lastMonthCount`, `statusBreakdown`.

- [ ] **Step 4: Commit**

```bash
git add src/routes/analytics.routes.js src/index.js
git commit -m "feat: add GET /api/analytics/overview endpoint"
```

---

### Task 13: Instalar Recharts en el frontend

**Files:**
- Modify: `frontend/package.json` (via npm install)

- [ ] **Step 1: Instalar Recharts**

```bash
cd frontend && npm install recharts
```

Expected: `added X packages`

- [ ] **Step 2: Verificar**

```bash
node -e "require('./node_modules/recharts'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add recharts for analytics dashboard"
```

---

### Task 14: Crear página Analytics.jsx

**Files:**
- Create: `frontend/src/pages/Analytics.jsx`

- [ ] **Step 1: Crear el archivo**

```jsx
// frontend/src/pages/Analytics.jsx
import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';
import api from '../api/client';

const STATUS_LABELS = {
  confirmed:  { label: 'Confirmadas', color: 'bg-emerald-500' },
  completed:  { label: 'Completadas', color: 'bg-indigo-500'  },
  cancelled:  { label: 'Canceladas',  color: 'bg-red-400'     },
  no_show:    { label: 'No asistió',  color: 'bg-amber-400'   }
};

export default function Analytics() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/analytics/overview')
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="text-slate-400 text-sm">Cargando analytics...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <p className="text-red-500 text-sm">Error al cargar los datos.</p>
      </div>
    );
  }

  const growth = data.lastMonthCount > 0
    ? Math.round(((data.thisMonthCount - data.lastMonthCount) / data.lastMonthCount) * 100)
    : null;

  const chartData = data.bookingsByDay.map(d => ({
    day:      d.day.slice(5),   // MM-DD
    reservas: d.count
  }));

  const maxService = data.topServices[0]?.count || 1;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Reservas este mes"
          value={data.thisMonthCount}
          sub={data.lastMonthCount > 0 ? `${data.lastMonthCount} el mes pasado` : null}
        />
        <StatCard
          label="Ingresos este mes"
          value={`$${Number(data.revenueThisMonth).toLocaleString('es-CL')}`}
          valueColor="text-emerald-600"
        />
        <StatCard
          label="Clientes únicos"
          value={data.totalClients}
        />
        <StatCard
          label="vs mes anterior"
          value={growth !== null ? `${growth > 0 ? '+' : ''}${growth}%` : '—'}
          valueColor={growth > 0 ? 'text-emerald-600' : growth < 0 ? 'text-red-500' : 'text-slate-400'}
          sub={growth !== null
            ? `${data.lastMonthCount} → ${data.thisMonthCount} reservas`
            : 'Sin datos del mes pasado'
          }
        />
      </div>

      {/* Bookings per day chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Reservas — últimos 28 días</h2>
        {chartData.length === 0 ? (
          <p className="text-sm text-slate-400 py-8 text-center">Sin reservas en este período</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                formatter={(v) => [v, 'Reservas']}
                cursor={{ fill: '#f8fafc' }}
              />
              <Bar dataKey="reservas" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top services */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Servicios más reservados</h2>
          {data.topServices.length === 0 ? (
            <p className="text-sm text-slate-400">Sin datos aún</p>
          ) : (
            <div className="space-y-4">
              {data.topServices.map((s, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs flex items-center justify-center font-bold shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-slate-800 truncate">{s.name}</span>
                      <span className="text-slate-500 ml-2 shrink-0">{s.count}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all"
                        style={{ width: `${(s.count / maxService) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Status breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Estado de reservas este mes</h2>
          {data.statusBreakdown.length === 0 ? (
            <p className="text-sm text-slate-400">Sin datos aún</p>
          ) : (
            <div className="space-y-3">
              {data.statusBreakdown.map(s => {
                const cfg = STATUS_LABELS[s.status] || { label: s.status, color: 'bg-slate-400' };
                const total = data.statusBreakdown.reduce((acc, x) => acc + x.count, 0);
                const pct   = Math.round((s.count / total) * 100);
                return (
                  <div key={s.status} className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.color}`} />
                    <span className="text-sm text-slate-700 flex-1">{cfg.label}</span>
                    <span className="text-sm text-slate-500">{s.count}</span>
                    <span className="text-xs text-slate-400 w-8 text-right">{pct}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, valueColor = 'text-indigo-600' }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${valueColor}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd frontend && git add src/pages/Analytics.jsx
git commit -m "feat: add Analytics page with recharts and stat cards"
```

---

### Task 15: Agregar Analytics al sidebar y al router

**Files:**
- Modify: `frontend/src/components/Layout.jsx`
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Añadir link de Analytics en Layout.jsx**

Abrir `frontend/src/components/Layout.jsx`. En el bloque de nav links, añadir Analytics (antes de "Configuración" si ya lo agregaste):

```jsx
<NavLink to="/dashboard/analytics" icon="📊" label="Analytics" />
```

> Usa el mismo patrón que los demás links del sidebar.

- [ ] **Step 2: Añadir ruta en App.jsx**

Abrir `frontend/src/App.jsx`. Añadir import y ruta:

```jsx
import Analytics from './pages/Analytics';
// ...dentro de las rutas protegidas:
<Route path="/dashboard/analytics" element={<Analytics />} />
```

- [ ] **Step 3: Probar en el navegador**

```bash
cd frontend && npm run dev
```

Abrir http://localhost:5173/dashboard/analytics. Verificar:
- [ ] Link "Analytics" con ícono 📊 aparece en el sidebar
- [ ] Los 4 stat cards se muestran (con 0 si no hay reservas)
- [ ] La gráfica de barras aparece (vacía si no hay reservas en 28 días)
- [ ] Top servicios y distribución de estados se muestran

- [ ] **Step 4: Commit final**

```bash
git add src/components/Layout.jsx src/App.jsx
git commit -m "feat: add Analytics link to sidebar and route"
```

---

## Resumen de Features

| Feature | Valor para el negocio | Complejidad | Dependencias externas |
|---------|----------------------|-------------|----------------------|
| A — Email + Recordatorios | ⭐⭐⭐⭐⭐ Reduce no-shows | Media | Resend.com (gratis hasta 3k/mes) |
| C — Settings de Perfil | ⭐⭐⭐⭐ Personalización básica | Baja | Ninguna |
| B — Analytics Dashboard | ⭐⭐⭐⭐ Decisiones basadas en datos | Media | Recharts (open source) |

---

*Plan generado 2026-05-02*
