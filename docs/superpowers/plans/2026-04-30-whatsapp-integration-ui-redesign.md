# WhatsApp Integration + UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conectar el bot de WhatsApp al SaaS para enviar confirmaciones al cliente y alertas al dueño al crear una reserva, y rediseñar toda la UI con estilo moderno (sidebar oscuro + split Calendly para la página pública).

**Architecture:** El bot expone un servidor HTTP Express en el puerto 3002 con el endpoint `POST /notify` protegido por token. El backend del SaaS llama a ese endpoint de forma fire-and-forget al crear una reserva pública. La UI del dashboard usa sidebar oscuro (`#0f172a`) con acento índigo, y la página pública de reservas usa layout split estilo Calendly.

**Tech Stack:** Node.js 20, Express (nuevo en el bot), whatsapp-web.js, React 19, Tailwind CSS 4, Vite

---

## File Map

### Bot (`C:\Users\Lenovo\whatsapp-bot`)
- **NEW** `src/core/http-server.js` — Servidor Express con `POST /notify`
- **MODIFY** `src/services/notifications.js` — Agregar `sendToClient()` y `notifyFromSaaS()`
- **MODIFY** `src/index.js` — Arrancar HTTP server junto al bot
- **MODIFY** `.env` — Agregar `HTTP_PORT`, `NOTIFY_SECRET`

### SaaS Backend (`C:\Users\Lenovo\Desktop\saas\backend`)
- **NEW** `src/services/whatsapp.js` — Función `notifyBooking()` que llama al bot
- **MODIFY** `src/controllers/bookings.controller.js` — Llamar `notifyBooking` en `publicCreate`
- **MODIFY** `.env` — Agregar `WHATSAPP_BOT_URL`, `WHATSAPP_BOT_SECRET`

### SaaS Frontend (`C:\Users\Lenovo\Desktop\saas\frontend\src`)
- **MODIFY** `components/Layout.jsx` — Sidebar oscuro reemplaza top nav
- **MODIFY** `pages/Login.jsx` — Layout split panel (izquierda oscura + derecha formulario)
- **MODIFY** `pages/Register.jsx` — Mismo split que Login
- **MODIFY** `pages/Bookings.jsx` — Stats cards + lista mejorada con avatares
- **MODIFY** `pages/Services.jsx` — Cards con icono + badges de duración/precio
- **MODIFY** `pages/BookingPage.jsx` — Split Calendly (panel info + wizard pasos)

---

## Task 1: Instalar Express en el bot

**Files:**
- Modify: `C:\Users\Lenovo\whatsapp-bot\package.json`

- [ ] **Step 1: Instalar express**

```bash
cd C:\Users\Lenovo\whatsapp-bot
npm install express
```

Resultado esperado: `added 1 package` (o similar), sin errores.

---

## Task 2: Crear el servidor HTTP del bot

**Files:**
- Create: `C:\Users\Lenovo\whatsapp-bot\src\core\http-server.js`

- [ ] **Step 1: Crear el archivo `http-server.js`**

```javascript
const express = require('express')

function createHttpServer(notificationService) {
  const app = express()
  app.use(express.json())

  const secret = process.env.NOTIFY_SECRET

  app.post('/notify', async (req, res) => {
    const auth = req.headers.authorization
    if (secret && auth !== `Bearer ${secret}`) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { name, phone, clientEmail, service, datetime, datetimeISO, businessName } = req.body
    if (!name || !datetime) {
      return res.status(400).json({ error: 'name y datetime son requeridos' })
    }

    notificationService.notifyFromSaaS({ name, phone, clientEmail, service, datetime, datetimeISO, businessName })
      .catch(err => console.error('[http] Error enviando notificaciones:', err))

    res.json({ ok: true })
  })

  function start(port = 3002) {
    app.listen(port, () => console.log(`[http] Servidor de notificaciones en puerto ${port}`))
  }

  return { start }
}

module.exports = { createHttpServer }
```

- [ ] **Step 2: Verificar que el archivo existe**

```bash
ls C:\Users\Lenovo\whatsapp-bot\src\core\
```

Debe aparecer `http-server.js` junto a `client.js`, `router.js`, `session.js`.

---

## Task 3: Agregar notificación al cliente en el bot

**Files:**
- Modify: `C:\Users\Lenovo\whatsapp-bot\src\services\notifications.js`

- [ ] **Step 1: Agregar `sendToClient` y `notifyFromSaaS` al final de `createNotificationService`, antes del `return`**

Localizar la línea `async function notify(booking)` y agregar después de ella (antes del `return { notify }`):

```javascript
  async function sendToClient(booking) {
    const client = getClient()
    if (!client) {
      console.log('[notif] Cliente WhatsApp no disponible — confirmación al cliente omitida')
      return
    }
    if (!booking.phone) {
      console.log('[notif] Sin teléfono del cliente — confirmación omitida')
      return
    }
    const digits = booking.phone.replace(/\D/g, '')
    if (digits.length < 8) {
      console.log('[notif] Teléfono inválido — confirmación omitida')
      return
    }
    const chatId = digits + '@c.us'
    const msg = [
      '✅ *¡Reserva confirmada!*',
      '',
      `Has reservado *${booking.service || 'tu cita'}* para el *${booking.datetime}* en *${booking.businessName}*.`,
      '',
      '¡Te esperamos! 🗓',
    ].join('\n')
    await client.sendMessage(chatId, msg)
    console.log(`[notif] Confirmación enviada al cliente ${booking.phone}`)
  }

  async function notifyFromSaaS(booking) {
    await Promise.allSettled([
      sendWhatsApp(booking),
      sendToClient(booking),
    ])
  }
```

- [ ] **Step 2: Cambiar el `return` al final de `createNotificationService` para exponer `notifyFromSaaS`**

Cambiar:
```javascript
  return { notify }
```

Por:
```javascript
  return { notify, notifyFromSaaS }
```

---

## Task 4: Arrancar el servidor HTTP junto al bot

**Files:**
- Modify: `C:\Users\Lenovo\whatsapp-bot\src\index.js`
- Modify: `C:\Users\Lenovo\whatsapp-bot\.env`

- [ ] **Step 1: Agregar el require de `http-server` al inicio de `src/index.js`**

Agregar después de la última línea de `require` existente (después de `const { createClient } = require('./core/client')`):

```javascript
const { createHttpServer } = require('./core/http-server')
```

- [ ] **Step 2: Arrancar el servidor HTTP al final de `src/index.js`**

Agregar al final del archivo (después de `clientRef.initialize()`):

```javascript
const httpServer = createHttpServer(notificationService)
httpServer.start(Number(process.env.HTTP_PORT) || 3002)
```

- [ ] **Step 3: Agregar variables al `.env` del bot**

Abrir `C:\Users\Lenovo\whatsapp-bot\.env` y agregar al final:

```
HTTP_PORT=3002
NOTIFY_SECRET=mi_secreto_compartido_cambia_esto
```

- [ ] **Step 4: Verificar que el bot arranca sin errores**

```bash
cd C:\Users\Lenovo\whatsapp-bot
node src/index.js
```

Esperar a ver en consola:
```
[http] Servidor de notificaciones en puerto 3002
```

El bot seguirá pidiendo QR o cargando sesión — eso es normal. Detener con Ctrl+C.

---

## Task 5: Crear el servicio WhatsApp en el SaaS backend

**Files:**
- Create: `C:\Users\Lenovo\Desktop\saas\backend\src\services\whatsapp.js`

- [ ] **Step 1: Crear el archivo `whatsapp.js`**

```javascript
function formatDatetime(isoString) {
  const d = new Date(isoString)
  const date = d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })
  const time = d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
  return `${date} a las ${time}`
}

async function notifyBooking({ clientName, clientPhone, clientEmail, serviceName, datetimeISO, businessName }) {
  const botUrl = process.env.WHATSAPP_BOT_URL
  if (!botUrl) return

  const secret = process.env.WHATSAPP_BOT_SECRET
  const headers = { 'Content-Type': 'application/json' }
  if (secret) headers['Authorization'] = `Bearer ${secret}`

  await fetch(`${botUrl}/notify`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: clientName,
      phone: clientPhone || '',
      clientEmail: clientEmail || '',
      service: serviceName || '',
      datetime: formatDatetime(datetimeISO),
      datetimeISO,
      businessName,
    }),
    signal: AbortSignal.timeout(5000),
  })
}

module.exports = { notifyBooking }
```

---

## Task 6: Llamar al bot al crear una reserva pública

**Files:**
- Modify: `C:\Users\Lenovo\Desktop\saas\backend\src\controllers\bookings.controller.js`
- Modify: `C:\Users\Lenovo\Desktop\saas\backend\.env`

- [ ] **Step 1: Agregar el require del servicio WhatsApp al inicio del controller**

Agregar en la línea 2 (después de `const db = require('../db/database');`):

```javascript
const { notifyBooking } = require('../services/whatsapp');
```

- [ ] **Step 2: Llamar a `notifyBooking` en `publicCreate` después de guardar la reserva**

Localizar en `publicCreate` la línea:
```javascript
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ ok: true, booking_id: booking.id, datetime_iso: booking.datetime_iso });
```

Reemplazar por:
```javascript
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(result.lastInsertRowid);

  const serviceRow = service_id
    ? db.prepare('SELECT name FROM services WHERE id = ?').get(service_id)
    : null;

  notifyBooking({
    clientName: client_name,
    clientPhone: client_phone || null,
    clientEmail: client_email || null,
    serviceName: serviceRow?.name || null,
    datetimeISO: datetime_iso,
    businessName: business.name,
  }).catch(err => console.error('[whatsapp] Error enviando notificación:', err));

  res.status(201).json({ ok: true, booking_id: booking.id, datetime_iso: booking.datetime_iso });
```

- [ ] **Step 3: Agregar variables al `.env` del SaaS backend**

Abrir `C:\Users\Lenovo\Desktop\saas\backend\.env` y agregar al final:

```
WHATSAPP_BOT_URL=http://localhost:3002
WHATSAPP_BOT_SECRET=mi_secreto_compartido_cambia_esto
```

El valor de `WHATSAPP_BOT_SECRET` debe ser idéntico al del bot.

- [ ] **Step 4: Verificar el backend arranca sin errores**

```bash
cd C:\Users\Lenovo\Desktop\saas\backend
npm start
```

Resultado esperado: `Server running on port 3001` sin errores de require.

- [ ] **Step 5: Probar la integración (con ambas apps corriendo)**

Con el bot corriendo (`node src/index.js` en `whatsapp-bot`) y el backend corriendo, hacer desde PowerShell:

```powershell
Invoke-RestMethod -Uri "http://localhost:3002/notify" `
  -Method POST `
  -Headers @{ Authorization = "Bearer mi_secreto_compartido_cambia_esto"; "Content-Type" = "application/json" } `
  -Body '{"name":"Test","phone":"+56911111111","service":"Consulta","datetime":"viernes 1 de mayo a las 10:00","datetimeISO":"2026-05-01T10:00:00","businessName":"Mi Negocio"}'
```

Resultado esperado: `{ ok: true }` y en la consola del bot ver los logs de notificación.

---

## Task 7: Rediseñar Layout (sidebar oscuro)

**Files:**
- Modify: `C:\Users\Lenovo\Desktop\saas\frontend\src\components\Layout.jsx`

- [ ] **Step 1: Reemplazar el contenido completo de `Layout.jsx`**

```jsx
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const links = [
  { to: '/dashboard', label: 'Reservas', icon: '📅' },
  { to: '/dashboard/servicios', label: 'Servicios', icon: '🛠' },
  { to: '/dashboard/horarios', label: 'Horarios', icon: '🕐' },
];

export default function Layout({ children }) {
  const { business, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

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
              target="_blank"
              rel="noreferrer"
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

- [ ] **Step 2: Verificar en el navegador**

Con el frontend corriendo (`npm run dev` en `frontend`), navegar a `http://localhost:5173/dashboard`. Verificar: sidebar oscuro visible a la izquierda, links de navegación funcionales, iniciales del negocio en el logo, "Página pública" y "Cerrar sesión" en la parte inferior.

---

## Task 8: Rediseñar Login y Register (split panel)

**Files:**
- Modify: `C:\Users\Lenovo\Desktop\saas\frontend\src\pages\Login.jsx`
- Modify: `C:\Users\Lenovo\Desktop\saas\frontend\src\pages\Register.jsx`

- [ ] **Step 1: Reemplazar el contenido completo de `Login.jsx`**

```jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ owner_email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(form.owner_email, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex w-1/2 bg-slate-900 flex-col items-center justify-center p-12 text-white">
        <div className="w-16 h-16 bg-indigo-500 rounded-2xl flex items-center justify-center text-3xl mb-6">📅</div>
        <h1 className="text-3xl font-bold mb-3">AgendaSaaS</h1>
        <p className="text-slate-400 text-center max-w-xs">
          Gestiona tus reservas, servicios y horarios desde un solo lugar.
        </p>
        <div className="mt-12 space-y-4 w-full max-w-xs">
          {['Reservas en línea 24/7', 'Notificaciones por WhatsApp', 'Panel de control completo'].map(f => (
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
          <h2 className="text-2xl font-bold text-slate-900 mb-1">Bienvenido de vuelta</h2>
          <p className="text-slate-500 text-sm mb-8">Accede al panel de tu negocio</p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <input
                name="owner_email" type="email" required value={form.owner_email} onChange={handle}
                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                placeholder="tu@email.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Contraseña</label>
              <input
                name="password" type="password" required value={form.password} onChange={handle}
                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
              />
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}
            <button
              type="submit" disabled={loading}
              className="w-full bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors mt-2"
            >
              {loading ? 'Ingresando...' : 'Iniciar sesión'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            ¿No tienes cuenta?{' '}
            <Link to="/register" className="text-indigo-600 hover:underline font-medium">Regístrate gratis</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Reemplazar el contenido completo de `Register.jsx`**

```jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', owner_email: '', password: '', phone: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await register(form.name, form.owner_email, form.password, form.phone);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrarse');
    } finally {
      setLoading(false);
    }
  };

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
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Nombre del negocio</label>
              <input
                name="name" required value={form.name} onChange={handle}
                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                placeholder="Ej: Barbería El Maestro"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <input
                name="owner_email" type="email" required value={form.owner_email} onChange={handle}
                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Contraseña</label>
              <input
                name="password" type="password" required minLength={6} value={form.password} onChange={handle}
                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Teléfono <span className="text-slate-400 font-normal">(opcional)</span>
              </label>
              <input
                name="phone" value={form.phone} onChange={handle}
                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                placeholder="+56 9 1234 5678"
              />
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
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

- [ ] **Step 3: Verificar en navegador**

Navegar a `http://localhost:5173/login`. Verificar: panel oscuro con beneficios a la izquierda, formulario a la derecha. Hacer login exitoso y verificar redirección al dashboard con sidebar. Probar también `http://localhost:5173/register`.

---

## Task 9: Rediseñar página de Reservas (stats + lista)

**Files:**
- Modify: `C:\Users\Lenovo\Desktop\saas\frontend\src\pages\Bookings.jsx`

- [ ] **Step 1: Reemplazar el contenido completo de `Bookings.jsx`**

```jsx
import { useEffect, useState } from 'react';
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

export default function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);

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

  const formatTime = (iso) => new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });

  const confirmed = bookings.filter(b => b.status === 'confirmed').length;
  const pending = bookings.filter(b => b.status === 'pending').length;

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
          <p className="text-sm text-slate-500 mb-1">Pendientes</p>
          <p className="text-3xl font-bold text-amber-500">{pending}</p>
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
            </div>
            <div className="text-indigo-600 font-bold text-sm shrink-0">
              {formatTime(b.datetime_iso)}
            </div>
            <div className="flex items-center gap-2 shrink-0">
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
    </div>
  );
}
```

- [ ] **Step 2: Verificar en navegador**

Navegar al dashboard. Verificar: 3 tarjetas de stats en la parte superior, lista de reservas con avatares de iniciales, badge de estado coloreado, selector de fecha estilizado.

---

## Task 10: Rediseñar página de Servicios

**Files:**
- Modify: `C:\Users\Lenovo\Desktop\saas\frontend\src\pages\Services.jsx`

- [ ] **Step 1: Reemplazar el contenido completo de `Services.jsx`**

```jsx
import { useEffect, useState } from 'react';
import api from '../api/client';

const inputClass = 'mt-1.5 w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white';

export default function Services() {
  const [services, setServices] = useState([]);
  const [form, setForm] = useState({ name: '', description: '', duration_min: 60, price: '' });
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const { data } = await api.get('/services');
    setServices(data);
  };

  useEffect(() => { load(); }, []);

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const reset = () => { setForm({ name: '', description: '', duration_min: 60, price: '' }); setEditing(null); };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form, duration_min: Number(form.duration_min), price: form.price ? Number(form.price) : null };
      if (editing) {
        await api.put(`/services/${editing}`, payload);
      } else {
        await api.post('/services', payload);
      }
      await load();
      reset();
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (s) => { await api.put(`/services/${s.id}`, { active: s.active ? 0 : 1 }); load(); };
  const edit = (s) => { setEditing(s.id); setForm({ name: s.name, description: s.description || '', duration_min: s.duration_min, price: s.price || '' }); };
  const remove = async (id) => { if (!confirm('¿Eliminar este servicio?')) return; await api.delete(`/services/${id}`); load(); };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Servicios</h1>
          <p className="text-slate-500 text-sm mt-0.5">Configura los servicios que ofreces</p>
        </div>
        {services.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center shadow-sm">
            <p className="text-4xl mb-3">🛠</p>
            <p className="text-slate-400 text-sm">Aún no tienes servicios. Agrega uno.</p>
          </div>
        )}
        <div className="space-y-3">
          {services.map((s) => (
            <div key={s.id} className={`bg-white rounded-2xl border border-slate-100 p-5 shadow-sm transition-opacity ${!s.active ? 'opacity-50' : ''}`}>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 font-bold text-sm shrink-0">
                  {s.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-900 text-sm">{s.name}</p>
                    {!s.active && <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Inactivo</span>}
                  </div>
                  {s.description && <p className="text-slate-500 text-xs mt-0.5">{s.description}</p>}
                  <div className="flex gap-2 mt-2">
                    <span className="text-xs text-slate-500 bg-slate-50 px-2 py-0.5 rounded-lg">⏱ {s.duration_min} min</span>
                    {s.price && <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg font-medium">${Number(s.price).toLocaleString('es-CL')}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => toggleActive(s)} className="text-xs text-slate-400 hover:text-slate-700 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                    {s.active ? 'Desactivar' : 'Activar'}
                  </button>
                  <button onClick={() => edit(s)} className="text-xs text-indigo-600 px-2 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors">Editar</button>
                  <button onClick={() => remove(s.id)} className="text-xs text-red-500 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors">Eliminar</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm h-fit">
        <h2 className="font-semibold text-slate-900 text-sm mb-5">{editing ? 'Editar servicio' : 'Nuevo servicio'}</h2>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-700">Nombre *</label>
            <input name="name" required value={form.name} onChange={handle} className={inputClass} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-700">Descripción</label>
            <input name="description" value={form.description} onChange={handle} className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-700">Duración (min)</label>
              <input name="duration_min" type="number" min="5" value={form.duration_min} onChange={handle} className={inputClass} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700">Precio</label>
              <input name="price" type="number" min="0" value={form.price} onChange={handle} placeholder="Opcional" className={inputClass} />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={loading}
              className="flex-1 bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {loading ? '...' : editing ? 'Guardar cambios' : 'Agregar servicio'}
            </button>
            {editing && (
              <button type="button" onClick={reset} className="px-4 py-2.5 text-sm text-slate-500 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors">
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar en navegador**

Navegar a Servicios. Verificar: lista de servicios con avatar de inicial, badges de duración y precio, formulario con estilos índigo.

---

## Task 11: Rediseñar BookingPage (split Calendly)

**Files:**
- Modify: `C:\Users\Lenovo\Desktop\saas\frontend\src\pages\BookingPage.jsx`

- [ ] **Step 1: Reemplazar el contenido completo de `BookingPage.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

function getDatesForNextDays(n = 30) {
  const dates = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push(d);
  }
  return dates;
}

const STEP_LABELS = ['Servicio', 'Fecha', 'Hora', 'Datos'];

function ProgressBar({ step }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {STEP_LABELS.map((label, i) => {
        const n = i + 1;
        const done = step > n;
        const active = step === n;
        return (
          <div key={label} className="flex items-center gap-2 flex-1 last:flex-none">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
              done ? 'bg-indigo-600 text-white' : active ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'
            }`}>
              {done ? '✓' : n}
            </div>
            <span className={`text-xs font-medium hidden sm:block ${active ? 'text-slate-900' : 'text-slate-400'}`}>{label}</span>
            {i < STEP_LABELS.length - 1 && (
              <div className={`flex-1 h-0.5 rounded-full ${done ? 'bg-indigo-600' : 'bg-slate-100'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function BookingPage() {
  const { slug } = useParams();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);

  const [selectedService, setSelectedService] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [form, setForm] = useState({ client_name: '', client_email: '', client_phone: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    axios.get(`/api/public/${slug}`)
      .then(({ data }) => setProfile(data))
      .catch(() => setError('Negocio no encontrado'));
  }, [slug]);

  if (error) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <p className="text-slate-400">{error}</p>
    </div>
  );

  if (!profile) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const { business, services, schedules } = profile;

  const availableDates = getDatesForNextDays(30).filter((d) => {
    const sched = schedules.find((s) => s.dow === d.getDay());
    return sched && sched.slots.length > 0;
  });

  const slotsForDate = selectedDate
    ? (schedules.find((s) => s.dow === selectedDate.getDay())?.slots || [])
    : [];

  const handleSubmit = async () => {
    if (!form.client_name) return;
    setSubmitting(true);
    try {
      const datetime_iso = `${selectedDate.toISOString().slice(0, 10)}T${selectedSlot}:00`;
      await axios.post(`/api/bookings/public/${slug}`, {
        client_name: form.client_name,
        client_email: form.client_email || undefined,
        client_phone: form.client_phone || undefined,
        service_id: selectedService?.id,
        datetime_iso,
        notes: form.notes || undefined,
      });
      setStep(5);
    } catch (err) {
      alert(err.response?.data?.error || 'Error al agendar');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = 'mt-1.5 w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-slate-50';

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left panel */}
      <div className="lg:w-80 bg-gradient-to-b from-slate-900 to-indigo-900 text-white p-8 lg:p-10 flex flex-col">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center font-bold text-lg">
            {business.name[0].toUpperCase()}
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">{business.name}</h1>
            <p className="text-indigo-300 text-xs">Reserva en línea</p>
          </div>
        </div>

        {step >= 2 && selectedService && (
          <div className="bg-white/10 rounded-2xl p-5 space-y-3">
            <p className="text-xs text-indigo-300 uppercase tracking-wider font-medium">Servicio seleccionado</p>
            <p className="font-semibold text-white">{selectedService.name}</p>
            {selectedService.description && (
              <p className="text-indigo-200 text-xs">{selectedService.description}</p>
            )}
            <div className="flex gap-3 pt-1">
              <span className="text-xs bg-white/10 px-3 py-1 rounded-full">⏱ {selectedService.duration_min} min</span>
              {selectedService.price && (
                <span className="text-xs bg-indigo-500/50 px-3 py-1 rounded-full font-medium">
                  ${Number(selectedService.price).toLocaleString('es-CL')}
                </span>
              )}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="mt-auto">
            <p className="text-indigo-300 text-sm">Elige un servicio para comenzar tu reserva.</p>
          </div>
        )}

        {step >= 3 && selectedDate && (
          <div className="mt-4 bg-white/10 rounded-2xl p-4">
            <p className="text-xs text-indigo-300 mb-1">Fecha</p>
            <p className="font-semibold capitalize">
              {DAYS[selectedDate.getDay()]} {selectedDate.getDate()} de {MONTHS[selectedDate.getMonth()]}
            </p>
            {step >= 4 && selectedSlot && (
              <p className="text-indigo-200 text-sm mt-1">🕐 {selectedSlot} hrs</p>
            )}
          </div>
        )}
      </div>

      {/* Right panel */}
      <div className="flex-1 bg-white p-8 lg:p-12 overflow-auto">

        {/* Step 5: Confirmación */}
        {step === 5 && (
          <div className="max-w-md mx-auto text-center pt-8">
            <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-6">✅</div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">¡Reserva confirmada!</h2>
            <p className="text-slate-500 mb-8">Tu hora ha sido agendada exitosamente en <strong>{business.name}</strong>.</p>
            <div className="bg-slate-50 rounded-2xl p-5 text-left text-sm space-y-3 mb-8">
              {selectedService && <div className="flex justify-between"><span className="text-slate-500">Servicio</span><span className="font-medium">{selectedService.name}</span></div>}
              {selectedDate && <div className="flex justify-between"><span className="text-slate-500">Fecha</span><span className="font-medium capitalize">{DAYS[selectedDate.getDay()]} {selectedDate.getDate()} de {MONTHS[selectedDate.getMonth()]}</span></div>}
              {selectedSlot && <div className="flex justify-between"><span className="text-slate-500">Hora</span><span className="font-medium">{selectedSlot} hrs</span></div>}
              <div className="flex justify-between"><span className="text-slate-500">Nombre</span><span className="font-medium">{form.client_name}</span></div>
            </div>
            {form.client_phone && (
              <p className="text-sm text-indigo-600 bg-indigo-50 rounded-xl px-4 py-3 mb-6">
                📱 Te enviaremos la confirmación al {form.client_phone}
              </p>
            )}
            <button
              onClick={() => { setStep(1); setSelectedService(null); setSelectedDate(null); setSelectedSlot(null); setForm({ client_name: '', client_email: '', client_phone: '', notes: '' }); }}
              className="text-sm text-indigo-600 hover:underline"
            >
              Agendar otra hora
            </button>
          </div>
        )}

        {step < 5 && (
          <div className="max-w-md mx-auto">
            <ProgressBar step={step} />

            {/* Step 1: Servicio */}
            {step === 1 && (
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-1">¿Qué servicio necesitas?</h2>
                <p className="text-slate-500 text-sm mb-6">Selecciona el servicio para tu cita</p>
                {services.length === 0 && <p className="text-slate-400 text-sm">Este negocio no tiene servicios configurados aún.</p>}
                <div className="space-y-3">
                  {services.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => { setSelectedService(s); setStep(2); }}
                      className="w-full text-left p-4 border-2 border-slate-100 rounded-2xl hover:border-indigo-400 hover:bg-indigo-50/50 transition-all group"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-semibold text-slate-900 text-sm group-hover:text-indigo-700">{s.name}</p>
                          {s.description && <p className="text-slate-400 text-xs mt-0.5">{s.description}</p>}
                        </div>
                        <div className="text-right shrink-0 ml-4">
                          <p className="text-sm text-slate-500">{s.duration_min} min</p>
                          {s.price && <p className="text-xs font-semibold text-indigo-600">${Number(s.price).toLocaleString('es-CL')}</p>}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Fecha */}
            {step === 2 && (
              <div>
                <button onClick={() => setStep(1)} className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-700 mb-6 transition-colors">
                  ← Volver
                </button>
                <h2 className="text-xl font-bold text-slate-900 mb-1">Elige una fecha</h2>
                <p className="text-slate-500 text-sm mb-6">Fechas disponibles en los próximos 30 días</p>
                {availableDates.length === 0 && <p className="text-slate-400 text-sm">No hay fechas disponibles en los próximos 30 días.</p>}
                <div className="grid grid-cols-3 gap-2">
                  {availableDates.map((d) => (
                    <button
                      key={d.toISOString()}
                      onClick={() => { setSelectedDate(d); setStep(3); }}
                      className="p-3 border-2 border-slate-100 rounded-2xl hover:border-indigo-400 hover:bg-indigo-50/50 transition-all text-center group"
                    >
                      <p className="text-xs text-slate-400 capitalize group-hover:text-indigo-500">{DAYS[d.getDay()].slice(0, 3)}</p>
                      <p className="font-bold text-slate-900 text-lg leading-tight">{d.getDate()}</p>
                      <p className="text-xs text-slate-400 capitalize">{MONTHS[d.getMonth()].slice(0, 3)}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Hora */}
            {step === 3 && (
              <div>
                <button onClick={() => setStep(2)} className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-700 mb-6 transition-colors">
                  ← Volver
                </button>
                <h2 className="text-xl font-bold text-slate-900 mb-1">Elige un horario</h2>
                <p className="text-slate-500 text-sm mb-6">Horarios disponibles para el día seleccionado</p>
                <div className="grid grid-cols-4 gap-2">
                  {slotsForDate.map((slot) => (
                    <button
                      key={slot}
                      onClick={() => { setSelectedSlot(slot); setStep(4); }}
                      className="py-3 border-2 border-slate-100 rounded-2xl text-sm font-semibold text-slate-700 hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700 transition-all"
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 4: Datos */}
            {step === 4 && (
              <div>
                <button onClick={() => setStep(3)} className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-700 mb-6 transition-colors">
                  ← Volver
                </button>
                <h2 className="text-xl font-bold text-slate-900 mb-1">Tus datos de contacto</h2>
                <p className="text-slate-500 text-sm mb-6">Para enviarte la confirmación de tu reserva</p>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-700">Nombre completo *</label>
                    <input
                      required value={form.client_name}
                      onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                      className={inputClass}
                      placeholder="Tu nombre"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700">Teléfono WhatsApp</label>
                    <input
                      value={form.client_phone}
                      onChange={(e) => setForm({ ...form, client_phone: e.target.value })}
                      placeholder="+56 9 ..."
                      className={inputClass}
                    />
                    <p className="text-xs text-slate-400 mt-1">Recibirás la confirmación por WhatsApp</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700">Email</label>
                    <input
                      type="email" value={form.client_email}
                      onChange={(e) => setForm({ ...form, client_email: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700">Notas adicionales</label>
                    <textarea
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      rows={2}
                      className={`${inputClass} resize-none`}
                      placeholder="Algo que el negocio deba saber..."
                    />
                  </div>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || !form.client_name}
                    className="w-full bg-indigo-600 text-white rounded-2xl py-3.5 text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors mt-2"
                  >
                    {submitting ? 'Agendando...' : 'Confirmar reserva →'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar en navegador**

Navegar a `http://localhost:5173/book/<tu-slug>`. Verificar: panel izquierdo oscuro visible con nombre del negocio, barra de progreso con 4 pasos, panel derecho blanco. Navegar los 4 pasos completos hasta la confirmación. Verificar que en el paso de confirmación aparece el mensaje de WhatsApp si se ingresó teléfono.

---

## Verificación final completa

- [ ] **Login** → panel split funciona, credenciales incorrectas muestran error, login exitoso redirige al dashboard con sidebar
- [ ] **Register** → panel split, registro exitoso redirige al dashboard
- [ ] **Dashboard sidebar** → links activos resaltados en índigo, iniciales del negocio, link a página pública, logout funcional
- [ ] **Reservas** → stats cards correctos, lista con avatares, cambio de estado funciona
- [ ] **Servicios** → crear/editar/eliminar/activar-desactivar funciona, diseño con cards
- [ ] **Página pública** → split layout, flujo completo de 4 pasos, confirmación exitosa
- [ ] **WhatsApp** (con bot corriendo) → al completar reserva pública, el dueño recibe alerta y el cliente recibe confirmación si ingresó teléfono
