# Fixes & Improvements — Plan A (P0 → P1 → P2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir todos los bugs críticos, hardening de producción y mejoras de UX que tiene la plataforma SaaS de agendamiento.

**Architecture:** El proyecto tiene tres capas: backend Node.js/Express en Railway con Neon PostgreSQL, frontend React/Vite en Vercel, y un bot de WhatsApp separado también en Railway. Los planes P0 arreglan bugs que ya causan reservas perdidas o errores silenciosos; P1 agrega lo mínimo para operar en producción sin miedo; P2 pule la UX sin agregar features de negocio nuevas.

**Tech Stack:** Node.js 20, Express, `pg` (PostgreSQL), React 19, Vite, Tailwind CSS, Railway, Vercel, Neon PostgreSQL

---

## Archivos que se modifican en este plan

| Archivo | Por qué |
|---------|---------|
| `backend/src/controllers/bookings.controller.js` | Normalizar TZ en comparaciones de fecha |
| `backend/src/jobs/reminders.js` | Comparaciones de datetime deben usar TIMESTAMPTZ real |
| `backend/src/routes/public.routes.js` | Agregar `/api/public/:slug/available-slots` que falta para el bot |
| `backend/src/middleware/plan.js` | Centralizar lista de planes válidos |
| `backend/src/services/email.js` | Agregar retry con exponential backoff |
| `backend/src/services/whatsapp.js` | Agregar retry |
| `backend/src/index.js` | Agregar error boundary global, health check mejorado |
| `frontend/src/components/Toast.jsx` | NUEVO: sistema de toasts (reemplaza alert()) |
| `frontend/src/context/ToastContext.jsx` | NUEVO: provider para toasts |
| `frontend/src/components/Skeleton.jsx` | NUEVO: componentes de skeleton loading |
| `frontend/src/components/ErrorBoundary.jsx` | NUEVO: error boundary para React |
| `frontend/src/pages/Services.jsx` | Reemplazar alert(), agregar toast + skeleton |
| `frontend/src/pages/Schedules.jsx` | Reemplazar alert(), agregar skeleton |
| `frontend/src/pages/Bookings.jsx` | Agregar skeleton, error boundary |
| `frontend/src/pages/Patients.jsx` | Reemplazar alert(), agregar skeleton |
| `frontend/src/pages/PatientDetail.jsx` | Reemplazar alert(), agregar skeleton |
| `frontend/src/pages/Professionals.jsx` | Reemplazar alert(), agregar skeleton |
| `frontend/src/App.jsx` | Wrappear con ErrorBoundary + ToastProvider |
| `frontend/src/api/client.js` | Mejor manejo de errores 401/500 |
| `whatsapp-bot/src/handlers/booking.handler.js` | Fix TZ offset hardcodeado → leerlo de config |
| `whatsapp-bot/src/db/database.js` | Agregar campo `timezone` en config de negocio |

---

## ══════════════════ P0 — BUGS CRÍTICOS ══════════════════

### Tarea 1: Normalizar timezone en validación de fecha pasada (booking.controller.js)

**El problema:** `new Date(datetime_iso) <= new Date()` en `publicCreate` asume UTC si no hay offset. Si el bot envía `"2026-06-09T12:30:00-04:00"` está bien, pero si llega sin offset (ej. desde la web), lo trata como UTC y puede rechazar horarios válidos.

**Archivos:**
- Modificar: `backend/src/controllers/bookings.controller.js:204`

- [ ] **Paso 1: Abrir el archivo y localizar la validación**

```bash
# Línea 204 en bookings.controller.js — función publicCreate:
# if (new Date(datetime_iso) <= new Date()) {
#   return res.status(400).json({ error: 'No se puede reservar en una fecha pasada' });
# }
```

- [ ] **Paso 2: Reemplazar la validación para que sea robusta a ausencia de TZ**

Reemplazar el bloque de validación en `publicCreate` (línea ~204):

```js
// ANTES:
if (new Date(datetime_iso) <= new Date()) {
  return res.status(400).json({ error: 'No se puede reservar en una fecha pasada' });
}

// DESPUÉS:
// Si no tiene offset de TZ, asumir Chile (UTC-4 verano / UTC-3 invierno).
// La forma más segura: si el string no contiene 'Z' ni '+' ni '-' después de 'T', agregar offset.
function parseDatetimeSafe(iso) {
  // Si ya tiene TZ explícita, usar directo
  if (/T.*[Z+\-]/.test(iso)) return new Date(iso);
  // Sin TZ: asumir Chile Standard Time (UTC-4)
  return new Date(iso + '-04:00');
}
const bookingDate = parseDatetimeSafe(datetime_iso);
if (isNaN(bookingDate.getTime())) {
  return res.status(400).json({ error: 'datetime_iso inválido' });
}
if (bookingDate <= new Date()) {
  return res.status(400).json({ error: 'No se puede reservar en una fecha pasada' });
}
```

También actualizar la comparación de conflicto para ser consistente — la columna `datetime_iso` en la DB guarda el string tal cual, así que la comparación de conflicto ya funciona por igualdad de string. No hay que cambiarla.

- [ ] **Paso 3: Commit**

```bash
git add backend/src/controllers/bookings.controller.js
git commit -m "fix: timezone-safe past-date validation in publicCreate"
```

---

### Tarea 2: Arreglar reminder job — comparación de datetime_iso como texto

**El problema:** `reminders.js` hace `b.datetime_iso >= $1 AND b.datetime_iso <= $2` donde `$1` y `$2` son ISO strings completos con UTC. Esto funciona SÓLO si `datetime_iso` en la DB tiene siempre el mismo formato (con offset). Si alguna reserva se guardó sin offset (ej. `"2026-06-09T12:30:00"`), la comparación lexicográfica puede fallar.

**Archivos:**
- Modificar: `backend/src/jobs/reminders.js`

- [ ] **Paso 1: Actualizar la query para normalizar con `AT TIME ZONE`**

```js
// En reminders.js, reemplazar la query dentro de sendReminders():

const { rows } = await db.query(`
  SELECT b.id, b.client_name, b.client_phone, b.client_email,
         b.datetime_iso, s.name AS service_name, bs.name AS business_name
  FROM   bookings b
  LEFT JOIN services    s  ON b.service_id   = s.id
  LEFT JOIN businesses  bs ON b.business_id  = bs.id
  WHERE  b.reminded = 0
    AND  b.status   = 'confirmed'
    AND  (
      -- Si datetime_iso tiene offset explícito, PostgreSQL lo parsea bien
      -- Si no tiene, asumir Chile (UTC-4)
      COALESCE(
        CASE WHEN b.datetime_iso ~ '[Z+\\-][0-9]' THEN b.datetime_iso::timestamptz
             ELSE (b.datetime_iso || '-04:00')::timestamptz
        END,
        b.datetime_iso::timestamptz
      ) >= $1::timestamptz
      AND
      COALESCE(
        CASE WHEN b.datetime_iso ~ '[Z+\\-][0-9]' THEN b.datetime_iso::timestamptz
             ELSE (b.datetime_iso || '-04:00')::timestamptz
        END,
        b.datetime_iso::timestamptz
      ) <= $2::timestamptz
    )
    AND  bs.plan IN ('pro', 'business')
`, [from, to]);
```

- [ ] **Paso 2: Commit**

```bash
git add backend/src/jobs/reminders.js
git commit -m "fix: normalize datetime_iso in reminder job to handle missing TZ offset"
```

---

### Tarea 3: Reemplazar todos los `alert()` del frontend con toasts

**El problema:** Hay llamadas a `alert()` nativo del browser en las páginas de Services, Patients, Professionals. El `alert()` bloquea el thread, no tiene estilo, y en producción algunos browsers lo suprimen en iframes/previews.

**Archivos:**
- Crear: `frontend/src/components/Toast.jsx`
- Crear: `frontend/src/context/ToastContext.jsx`
- Modificar: `frontend/src/App.jsx`
- Modificar: `frontend/src/pages/Services.jsx`
- Modificar: `frontend/src/pages/Patients.jsx`
- Modificar: `frontend/src/pages/PatientDetail.jsx`
- Modificar: `frontend/src/pages/Professionals.jsx`
- Modificar: `frontend/src/pages/Schedules.jsx`

- [ ] **Paso 1: Crear `ToastContext.jsx`**

```jsx
// frontend/src/context/ToastContext.jsx
import { createContext, useCallback, useContext, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const toast = {
    success: (msg, dur) => addToast(msg, 'success', dur),
    error:   (msg, dur) => addToast(msg, 'error',   dur),
    info:    (msg, dur) => addToast(msg, 'info',     dur),
    warning: (msg, dur) => addToast(msg, 'warning',  dur),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

const TYPE_STYLES = {
  success: 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300',
  error:   'bg-red-500/10 border-red-500/40 text-red-300',
  info:    'bg-blue-500/10 border-blue-500/40 text-blue-300',
  warning: 'bg-amber-500/10 border-amber-500/40 text-amber-300',
};

const TYPE_ICONS = {
  success: '✓',
  error:   '✕',
  info:    'ℹ',
  warning: '⚠',
};

function ToastContainer({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium shadow-xl backdrop-blur-sm max-w-sm animate-in slide-in-from-right-2 ${TYPE_STYLES[t.type]}`}
        >
          <span className="shrink-0 font-bold">{TYPE_ICONS[t.type]}</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Paso 2: Agregar ToastProvider en `App.jsx`**

En `frontend/src/App.jsx`, importar `ToastProvider` y wrappear el router:

```jsx
// Agregar import:
import { ToastProvider } from './context/ToastContext';

// Wrappear el JSX retornado:
return (
  <ToastProvider>
    <AuthProvider>
      {/* ... router existente ... */}
    </AuthProvider>
  </ToastProvider>
);
```

- [ ] **Paso 3: Buscar todos los alert() en el frontend**

```bash
grep -rn "alert(" frontend/src/pages/
```

Resultado esperado: aparecen en Services.jsx, Patients.jsx, PatientDetail.jsx, Professionals.jsx

- [ ] **Paso 4: Reemplazar en Services.jsx**

Agregar el import en la primera línea:
```jsx
import { useToast } from '../context/ToastContext';
```

Dentro del componente, agregar:
```jsx
const toast = useToast();
```

Reemplazar cada `alert('...')` con `toast.error('...')` o `toast.success('...')` según el contexto:
- Errores de API → `toast.error('No se pudo guardar el servicio')`
- Confirmaciones de borrado → cambiar `confirm()` por un modal (ver Tarea 4) o simplemente `toast.info()`
- Éxitos → `toast.success('Servicio guardado')`

- [ ] **Paso 5: Repetir para Patients.jsx, PatientDetail.jsx, Professionals.jsx, Schedules.jsx**

Misma mecánica: importar `useToast`, reemplazar `alert()` / `confirm()`.

- [ ] **Paso 6: Verificar en navegador**

```bash
cd frontend && npm run dev
# Abrir http://localhost:5173/dashboard/servicios
# Guardar un servicio → debe aparecer toast verde abajo derecha
# Generar error (borrar servicio en uso) → debe aparecer toast rojo
```

- [ ] **Paso 7: Commit**

```bash
git add frontend/src/context/ToastContext.jsx frontend/src/App.jsx \
        frontend/src/pages/Services.jsx frontend/src/pages/Patients.jsx \
        frontend/src/pages/PatientDetail.jsx frontend/src/pages/Professionals.jsx \
        frontend/src/pages/Schedules.jsx
git commit -m "feat: replace alert() with toast notification system"
```

---

### Tarea 4: Reemplazar `confirm()` con modal de confirmación

**El problema:** `confirm()` del browser también bloquea el thread y no tiene estilo. Hay al menos un `confirm()` en la eliminación de servicios/profesionales.

**Archivos:**
- Crear: `frontend/src/components/ConfirmModal.jsx`
- Modificar: `frontend/src/pages/Services.jsx`, `Professionals.jsx`, `Patients.jsx`

- [ ] **Paso 1: Crear `ConfirmModal.jsx`**

```jsx
// frontend/src/components/ConfirmModal.jsx
export default function ConfirmModal({ open, title, message, onConfirm, onCancel, danger = true }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl">
        <h3 className="text-white font-semibold text-base mb-2">{title}</h3>
        <p className="text-zinc-400 text-sm mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-zinc-600 text-zinc-300 text-sm hover:bg-zinc-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              danger
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Paso 2: Usar en Services.jsx para el delete**

```jsx
// Agregar estado:
const [confirmDelete, setConfirmDelete] = useState(null); // guarda el id a eliminar

// Reemplazar:
// const del = async (id) => { if (confirm('¿Eliminar?')) { await api.delete(...) } }
// Por:
const del = (id) => setConfirmDelete(id);
const doDelete = async () => {
  await api.delete(`/services/${confirmDelete}`);
  setConfirmDelete(null);
  toast.success('Servicio eliminado');
  load();
};

// En el JSX, agregar el modal:
<ConfirmModal
  open={!!confirmDelete}
  title="Eliminar servicio"
  message="¿Seguro que quieres eliminar este servicio? Esta acción no se puede deshacer."
  onConfirm={doDelete}
  onCancel={() => setConfirmDelete(null)}
/>
```

- [ ] **Paso 3: Commit**

```bash
git add frontend/src/components/ConfirmModal.jsx frontend/src/pages/Services.jsx \
        frontend/src/pages/Professionals.jsx frontend/src/pages/Patients.jsx
git commit -m "feat: replace confirm() dialogs with styled ConfirmModal component"
```

---

### Tarea 5: Agregar retry con backoff en email y WhatsApp

**El problema:** Si el servidor SMTP o la API de WhatsApp falla una vez, se pierde la notificación silenciosamente. Hay un `catch` que solo loguea.

**Archivos:**
- Modificar: `backend/src/services/email.js`
- Modificar: `backend/src/services/whatsapp.js`

- [ ] **Paso 1: Crear helper de retry en `backend/src/lib/retry.js`**

```js
// backend/src/lib/retry.js
/**
 * Reintenta `fn` hasta `maxAttempts` veces con backoff exponencial.
 * @param {Function} fn - función async a reintentar
 * @param {number} maxAttempts - máximo de intentos (default: 3)
 * @param {number} baseDelayMs - delay base en ms (default: 1000)
 */
async function withRetry(fn, maxAttempts = 3, baseDelayMs = 1000) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1); // 1s, 2s, 4s
        console.warn(`[retry] Intento ${attempt}/${maxAttempts} fallido, reintentando en ${delay}ms:`, err.message);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

module.exports = { withRetry };
```

- [ ] **Paso 2: Usar retry en `email.js`**

```js
// En backend/src/services/email.js, agregar al inicio:
const { withRetry } = require('../lib/retry');

// En sendBookingConfirmation() y sendBusinessNotification(), wrappear el transporter.sendMail():
// ANTES:
// await transporter.sendMail(mailOptions);

// DESPUÉS:
await withRetry(() => transporter.sendMail(mailOptions), 3, 1000);
```

- [ ] **Paso 3: Usar retry en `whatsapp.js`**

```js
// En backend/src/services/whatsapp.js, agregar al inicio:
const { withRetry } = require('../lib/retry');

// Wrappear el fetch/axios call:
await withRetry(() => axios.post(url, payload, { headers }), 3, 1500);
```

- [ ] **Paso 4: Test manual**

```bash
# En Railway, ver logs después de una reserva:
# Esperado: si SMTP falla una vez, debe aparecer:
# "[retry] Intento 1/3 fallido, reintentando en 1000ms: ..."
# y luego éxito en el 2do intento
```

- [ ] **Paso 5: Commit**

```bash
git add backend/src/lib/retry.js backend/src/services/email.js backend/src/services/whatsapp.js
git commit -m "feat: add exponential backoff retry to email and WhatsApp notifications"
```

---

## ══════════════════ P1 — HARDENING DE PRODUCCIÓN ══════════════════

### Tarea 6: Error boundary en React

**El problema:** Si cualquier página React lanza un error no capturado, toda la app se rompe y el usuario ve una pantalla en blanco sin poder hacer nada.

**Archivos:**
- Crear: `frontend/src/components/ErrorBoundary.jsx`
- Modificar: `frontend/src/App.jsx`

- [ ] **Paso 1: Crear `ErrorBoundary.jsx`**

```jsx
// frontend/src/components/ErrorBoundary.jsx
import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Unhandled React error:', error, info);
    // TODO Tarea 7: enviar a Sentry aquí
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-8">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-8 max-w-md w-full text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h1 className="text-white text-xl font-semibold mb-2">Algo salió mal</h1>
            <p className="text-zinc-400 text-sm mb-6">
              Ocurrió un error inesperado. Por favor recarga la página.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors"
            >
              Recargar página
            </button>
            {import.meta.env.DEV && (
              <pre className="mt-4 text-left text-xs text-red-400 bg-red-500/10 rounded-lg p-3 overflow-auto max-h-40">
                {this.state.error?.toString()}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
```

- [ ] **Paso 2: Wrappear la app en `App.jsx`**

```jsx
// En App.jsx, importar:
import ErrorBoundary from './components/ErrorBoundary';

// Wrappear todo el contenido:
return (
  <ErrorBoundary>
    <ToastProvider>
      <AuthProvider>
        {/* router */}
      </AuthProvider>
    </ToastProvider>
  </ErrorBoundary>
);
```

- [ ] **Paso 3: Commit**

```bash
git add frontend/src/components/ErrorBoundary.jsx frontend/src/App.jsx
git commit -m "feat: add React ErrorBoundary to prevent blank-screen crashes"
```

---

### Tarea 7: Loading skeletons en páginas principales

**El problema:** Mientras cargan los datos, las páginas muestran nada o un spinner minimal. El usuario no sabe si algo cargó.

**Archivos:**
- Crear: `frontend/src/components/Skeleton.jsx`
- Modificar: `frontend/src/pages/Bookings.jsx`, `Services.jsx`, `Patients.jsx`, `Professionals.jsx`

- [ ] **Paso 1: Crear `Skeleton.jsx`**

```jsx
// frontend/src/components/Skeleton.jsx
export function SkeletonLine({ className = '' }) {
  return <div className={`bg-zinc-800 rounded animate-pulse ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-zinc-800 animate-pulse shrink-0" />
        <div className="flex-1 space-y-2">
          <SkeletonLine className="h-4 w-3/4" />
          <SkeletonLine className="h-3 w-1/2" />
        </div>
      </div>
      <SkeletonLine className="h-3 w-full" />
      <SkeletonLine className="h-3 w-4/5" />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
          <SkeletonLine className="h-4 w-1/4" />
          <SkeletonLine className="h-4 w-1/3" />
          <SkeletonLine className="h-4 w-1/5" />
          <SkeletonLine className="h-4 w-1/6 ml-auto" />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Paso 2: Usar en Bookings.jsx**

```jsx
// Importar:
import { SkeletonTable } from '../components/Skeleton';

// En el render, ANTES de mostrar la lista:
if (loading) return <SkeletonTable rows={6} />;
```

- [ ] **Paso 3: Usar en Services.jsx, Patients.jsx, Professionals.jsx**

Misma mecánica: importar `SkeletonCard` y mostrar `Array.from({length: 4}).map((_,i) => <SkeletonCard key={i} />)` cuando `loading === true`.

- [ ] **Paso 4: Commit**

```bash
git add frontend/src/components/Skeleton.jsx \
        frontend/src/pages/Bookings.jsx frontend/src/pages/Services.jsx \
        frontend/src/pages/Patients.jsx frontend/src/pages/Professionals.jsx
git commit -m "feat: add skeleton loading states to main dashboard pages"
```

---

### Tarea 8: Mejorar manejo de errores 401 en Axios (auto-logout)

**El problema:** Si el JWT expira y el usuario hace una acción, recibe un error genérico o pantalla rota. Debería redirigir al login automáticamente.

**Archivos:**
- Modificar: `frontend/src/api/client.js`
- Modificar: `frontend/src/context/AuthContext.jsx`

- [ ] **Paso 1: Revisar el interceptor actual en `client.js`**

```bash
cat frontend/src/api/client.js
# Verificar si ya hay un interceptor de respuesta para 401
```

- [ ] **Paso 2: Agregar/corregir el interceptor**

```js
// En frontend/src/api/client.js
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

// Interceptor de request: agregar Authorization header
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Interceptor de response: manejar 401 (token expirado)
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      // Limpiar sesión y redirigir a login
      localStorage.removeItem('token');
      // Disparar evento para que AuthContext reaccione
      window.dispatchEvent(new Event('auth:logout'));
    }
    return Promise.reject(err);
  }
);

export default api;
```

- [ ] **Paso 3: Escuchar el evento en `AuthContext.jsx`**

```jsx
// En AuthContext.jsx, dentro del useEffect inicial:
useEffect(() => {
  const handleLogout = () => {
    setToken(null);
    setBusiness(null);
  };
  window.addEventListener('auth:logout', handleLogout);
  return () => window.removeEventListener('auth:logout', handleLogout);
}, []);
```

- [ ] **Paso 4: Commit**

```bash
git add frontend/src/api/client.js frontend/src/context/AuthContext.jsx
git commit -m "fix: auto-logout and redirect to login on 401 response"
```

---

### Tarea 9: Health check endpoint mejorado

**El problema:** El health check en `GET /health` retorna `{ok:true}` pero no verifica si la DB está realmente respondiendo. Railway lo usa para saber si el servicio está saludable.

**Archivos:**
- Modificar: `backend/src/index.js`

- [ ] **Paso 1: Localizar el health check actual**

```bash
grep -n "health" backend/src/index.js
```

- [ ] **Paso 2: Reemplazar con health check que testa la DB**

```js
// Reemplazar la ruta /health en index.js:
app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ ok: true, db: 'up', uptime: process.uptime() });
  } catch (err) {
    console.error('[health] DB check failed:', err.message);
    res.status(503).json({ ok: false, db: 'down', error: err.message });
  }
});
```

- [ ] **Paso 3: Commit**

```bash
git add backend/src/index.js
git commit -m "feat: health check endpoint now verifies DB connectivity"
```

---

### Tarea 10: Configurar UptimeRobot (monitoreo gratis)

**El problema:** Nadie sabe si el backend o frontend se cae. UptimeRobot hace ping cada 5 minutos gratis.

**No hay código que cambiar — es configuración.**

- [ ] **Paso 1: Crear cuenta en https://uptimerobot.com (plan Free)**

- [ ] **Paso 2: Agregar 3 monitores tipo HTTP(s)**

| Nombre | URL | Intervalo |
|--------|-----|-----------|
| SaaS API | `https://saas-agendamiento-production.up.railway.app/health` | 5 min |
| SaaS Frontend | `https://workly.cl` (o la URL de Vercel) | 5 min |
| WhatsApp Bot | `https://tu-bot.up.railway.app/health` | 5 min |

- [ ] **Paso 3: Configurar alertas por email a `joseestebanasencio@gmail.com`**

- [ ] **Paso 4: Anotar las URLs en `backend/.env.example`**

```bash
# Agregar comentario al final de .env.example:
# UPTIME_ROBOT_API_KEY=xxx  (opcional, para integrar alertas)
```

---

### Tarea 11: GitHub Actions — CI básico (lint + tests en cada push)

**El problema:** No hay CI. Un push roto llega directo a producción sin que nadie lo note.

**Archivos:**
- Crear: `.github/workflows/ci.yml`

- [ ] **Paso 1: Crear el directorio si no existe**

```bash
mkdir -p .github/workflows
```

- [ ] **Paso 2: Crear `ci.yml`**

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  backend-test:
    name: Backend Tests
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json
      - run: npm ci
      - run: npm test
        env:
          ENCRYPTION_KEY: 0000000000000000000000000000000000000000000000000000000000000000
          NODE_ENV: test

  frontend-lint:
    name: Frontend Lint & Build
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
      - run: npm run lint
      - run: npm run build
        env:
          VITE_API_URL: https://saas-agendamiento-production.up.railway.app
```

- [ ] **Paso 3: Push y verificar que el workflow corra**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions workflow for backend tests and frontend lint/build"
git push
# Ir a GitHub → Actions → verificar que el workflow pase
```

---

### Tarea 12: Backups automáticos de Neon PostgreSQL

**El problema:** Neon Free/Serverless no tiene backup automático configurable desde el dashboard. Hay que scriptear un pg_dump periódico.

**Archivos:**
- Crear: `backend/scripts/backup-db.sh`
- Crear: `.github/workflows/backup.yml`

- [ ] **Paso 1: Crear el script de backup**

```bash
# backend/scripts/backup-db.sh
#!/bin/bash
set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="backup_${TIMESTAMP}.sql.gz"

echo "[backup] Iniciando backup: $BACKUP_FILE"
pg_dump "$DATABASE_URL" | gzip > "/tmp/$BACKUP_FILE"
echo "[backup] Backup creado: $(du -sh /tmp/$BACKUP_FILE | cut -f1)"

# Subir a un bucket (si tienes S3/R2 configurado)
# aws s3 cp "/tmp/$BACKUP_FILE" "s3://tu-bucket/backups/$BACKUP_FILE"
# Por ahora solo guardar localmente y loguear
echo "[backup] Completado: $BACKUP_FILE"
```

- [ ] **Paso 2: Crear workflow programado en GitHub Actions**

```yaml
# .github/workflows/backup.yml
name: Daily DB Backup

on:
  schedule:
    - cron: '0 6 * * *'  # Cada día a las 6am UTC (3am Chile)
  workflow_dispatch:      # También manual desde GitHub UI

jobs:
  backup:
    name: PostgreSQL Backup
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install PostgreSQL client
        run: sudo apt-get install -y postgresql-client
      - name: Create backup
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: |
          TIMESTAMP=$(date +%Y%m%d_%H%M%S)
          pg_dump "$DATABASE_URL" | gzip > "backup_${TIMESTAMP}.sql.gz"
          ls -lh backup_*.sql.gz
      - name: Upload backup as artifact
        uses: actions/upload-artifact@v4
        with:
          name: db-backup-${{ github.run_id }}
          path: backup_*.sql.gz
          retention-days: 7
```

- [ ] **Paso 3: Agregar `DATABASE_URL` a GitHub Secrets**

```
GitHub repo → Settings → Secrets → Actions → New secret
Name: DATABASE_URL
Value: (el string de conexión de Neon, lo encuentras en Railway o Neon dashboard)
```

- [ ] **Paso 4: Commit**

```bash
git add backend/scripts/backup-db.sh .github/workflows/backup.yml
git commit -m "feat: automated daily PostgreSQL backup via GitHub Actions"
```

---

## ══════════════════ P2 — UX POLISH ══════════════════

### Tarea 13: Vista de calendario mensual (adicional a la semanal)

**El problema:** La vista de calendario solo muestra una semana. Para ver el mes completo o días lejanos hay que navegar semana a semana.

**Archivos:**
- Modificar: `frontend/src/pages/Bookings.jsx`

- [ ] **Paso 1: Agregar estado para cambiar vista en Bookings.jsx**

```jsx
// Agregar estado de vista al inicio del componente:
const [viewMode, setViewMode] = useState('week'); // 'week' | 'month' | 'list'
```

- [ ] **Paso 2: Agregar botones de cambio de vista**

```jsx
// En el JSX, junto a los controles existentes:
<div className="flex gap-1 bg-zinc-800 rounded-xl p-1">
  {[
    { key: 'list',  label: 'Lista' },
    { key: 'week',  label: 'Semana' },
    { key: 'month', label: 'Mes' },
  ].map(v => (
    <button
      key={v.key}
      onClick={() => setViewMode(v.key)}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
        viewMode === v.key
          ? 'bg-zinc-700 text-white'
          : 'text-zinc-400 hover:text-white'
      }`}
    >
      {v.label}
    </button>
  ))}
</div>
```

- [ ] **Paso 3: Crear el componente `MonthView` dentro de Bookings.jsx**

```jsx
function MonthView({ bookings, navigate }) {
  const [month, setMonth] = useState(() => {
    const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const year = month.getFullYear();
  const mon  = month.getMonth();
  const firstDay = new Date(year, mon, 1);
  const lastDay  = new Date(year, mon + 1, 0);

  // días previos al primer día del mes (para completar la grilla)
  const startDow = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // lunes=0
  const totalCells = startDow + lastDay.getDate();
  const rows = Math.ceil(totalCells / 7);

  const byDate = {};
  bookings.forEach(b => {
    const key = b.datetime_iso.slice(0, 10);
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(b);
  });

  const cells = [];
  for (let i = 0; i < rows * 7; i++) {
    const dayNum = i - startDow + 1;
    if (dayNum < 1 || dayNum > lastDay.getDate()) {
      cells.push(null);
    } else {
      const d = new Date(year, mon, dayNum);
      cells.push(d);
    }
  }

  const todayStr = new Date().toISOString().slice(0, 10);

  const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  return (
    <div>
      {/* Navegación de mes */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setMonth(new Date(year, mon - 1, 1))}
          className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
        >
          ←
        </button>
        <span className="text-white font-semibold">{MONTHS_ES[mon]} {year}</span>
        <button
          onClick={() => setMonth(new Date(year, mon + 1, 1))}
          className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
        >
          →
        </button>
      </div>
      {/* Cabecera días semana */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d => (
          <div key={d} className="text-center text-xs text-zinc-500 py-1">{d}</div>
        ))}
      </div>
      {/* Celdas */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="h-20 rounded-lg bg-zinc-900/30" />;
          const dateStr = `${year}-${String(mon+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
          const dayBookings = byDate[dateStr] || [];
          const isToday = dateStr === todayStr;
          return (
            <div
              key={i}
              className={`h-20 rounded-lg p-1.5 border cursor-pointer hover:border-zinc-600 transition-colors overflow-hidden ${
                isToday ? 'border-red-500/50 bg-red-500/5' : 'border-zinc-800 bg-zinc-900'
              }`}
              onClick={() => navigate(`/dashboard?date=${dateStr}`)}
            >
              <span className={`text-xs font-medium ${isToday ? 'text-red-400' : 'text-zinc-400'}`}>
                {d.getDate()}
              </span>
              {dayBookings.slice(0, 2).map(b => (
                <div key={b.id} className="mt-0.5 text-[10px] bg-red-500/20 text-red-300 rounded px-1 truncate">
                  {b.datetime_iso.slice(11, 16)} {b.client_name.split(' ')[0]}
                </div>
              ))}
              {dayBookings.length > 2 && (
                <div className="text-[10px] text-zinc-500 mt-0.5">+{dayBookings.length - 2} más</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Paso 4: Renderizar la vista según `viewMode`**

```jsx
// En el render principal, después del header:
{viewMode === 'list' && <ListView bookings={filteredBookings} />}
{viewMode === 'week' && <CalendarView bookings={filteredBookings} navigate={navigate} />}
{viewMode === 'month' && <MonthView bookings={allBookings} navigate={navigate} />}
// Nota: MonthView necesita todos los bookings del mes, no solo del día filtrado.
// Pasarle `bookings` sin filtro de fecha para que muestre el mes completo.
```

- [ ] **Paso 5: Commit**

```bash
git add frontend/src/pages/Bookings.jsx
git commit -m "feat: add monthly calendar view to bookings dashboard"
```

---

### Tarea 14: Barra de búsqueda global en el dashboard

**El problema:** No hay forma de buscar una reserva o paciente desde el dashboard sin ir a la página específica y escribir ahí.

**Archivos:**
- Crear: `frontend/src/components/GlobalSearch.jsx`
- Modificar: `frontend/src/components/Layout.jsx`

- [ ] **Paso 1: Crear `GlobalSearch.jsx`**

```jsx
// frontend/src/components/GlobalSearch.jsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ bookings: [], patients: [] });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef();

  // Abrir con Ctrl+K o Cmd+K
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults({ bookings: [], patients: [] });
      return;
    }
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const [bRes, pRes] = await Promise.all([
          api.get(`/bookings?search=${encodeURIComponent(query)}&limit=5`).catch(() => ({ data: { bookings: [] } })),
          api.get(`/patients?search=${encodeURIComponent(query)}&limit=5`).catch(() => ({ data: [] })),
        ]);
        setResults({
          bookings: bRes.data.bookings || [],
          patients: Array.isArray(pRes.data) ? pRes.data : (pRes.data.patients || []),
        });
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-1.5 text-sm text-zinc-400 hover:text-white transition-colors"
      >
        <span>🔍</span>
        <span className="hidden sm:inline">Buscar...</span>
        <kbd className="hidden sm:inline text-xs bg-zinc-700 px-1.5 py-0.5 rounded">⌘K</kbd>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center pt-20 px-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-zinc-800">
          <span className="text-zinc-400">🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar reservas, pacientes..."
            className="flex-1 bg-transparent text-white placeholder:text-zinc-500 outline-none text-sm"
          />
          {loading && <span className="text-zinc-500 text-xs">...</span>}
          <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-white text-xs">ESC</button>
        </div>
        {(results.bookings.length > 0 || results.patients.length > 0) && (
          <div className="max-h-80 overflow-y-auto p-2 space-y-1">
            {results.patients.length > 0 && (
              <>
                <div className="px-3 py-1 text-xs text-zinc-500 font-medium">PACIENTES</div>
                {results.patients.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { navigate(`/dashboard/paciente/${p.id}`); setOpen(false); setQuery(''); }}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-zinc-800 transition-colors"
                  >
                    <span className="text-white text-sm">{p.name}</span>
                    <span className="text-zinc-500 text-xs ml-2">{p.rut}</span>
                  </button>
                ))}
              </>
            )}
            {results.bookings.length > 0 && (
              <>
                <div className="px-3 py-1 text-xs text-zinc-500 font-medium">RESERVAS</div>
                {results.bookings.map(b => (
                  <button
                    key={b.id}
                    onClick={() => { navigate('/dashboard'); setOpen(false); setQuery(''); }}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-zinc-800 transition-colors"
                  >
                    <span className="text-white text-sm">{b.client_name}</span>
                    <span className="text-zinc-500 text-xs ml-2">{b.datetime_iso?.slice(0, 16).replace('T', ' ')}</span>
                  </button>
                ))}
              </>
            )}
          </div>
        )}
        {query.length >= 2 && !loading && results.bookings.length === 0 && results.patients.length === 0 && (
          <div className="p-6 text-center text-zinc-500 text-sm">Sin resultados para "{query}"</div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Paso 2: Agregar búsqueda por `search` en el backend (bookings)**

En `backend/src/controllers/bookings.controller.js`, en la función `list`, agregar soporte para `?search=`:

```js
// Después de los filtros existentes (date, from, status):
const search = req.query.search?.trim();
if (search) {
  where += ` AND (b.client_name ILIKE $${i} OR b.client_phone ILIKE $${i} OR b.client_rut ILIKE $${i})`;
  params.push(`%${search}%`);
  i++;
}
```

- [ ] **Paso 3: Agregar `GlobalSearch` en `Layout.jsx`**

```jsx
// En el header del Layout, junto al nombre del usuario:
import GlobalSearch from './GlobalSearch';

// En el JSX del header:
<GlobalSearch />
```

- [ ] **Paso 4: Commit**

```bash
git add frontend/src/components/GlobalSearch.jsx frontend/src/components/Layout.jsx \
        backend/src/controllers/bookings.controller.js
git commit -m "feat: add global search with Ctrl+K shortcut"
```

---

### Tarea 15: Botón de copiar link de reserva pública

**El problema:** Para compartir la página de reserva con pacientes, el usuario tiene que navegar manualmente a `/book/workly` o buscarlo. No hay un botón visible en el dashboard.

**Archivos:**
- Modificar: `frontend/src/components/Layout.jsx` o `frontend/src/pages/Settings.jsx`

- [ ] **Paso 1: Agregar banner de "tu link de reserva" en el Dashboard principal (Bookings.jsx)**

```jsx
// Al inicio del componente, obtener el business del AuthContext
const { business } = useAuth();

// En el JSX, antes de los filtros, agregar un banner sutil:
{business?.slug && (
  <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 mb-4">
    <div>
      <p className="text-xs text-zinc-500">Tu página de reservas pública</p>
      <p className="text-sm text-zinc-300 font-medium">/book/{business.slug}</p>
    </div>
    <button
      onClick={() => {
        navigator.clipboard.writeText(`${window.location.origin}/book/${business.slug}`);
        toast.success('Link copiado al portapapeles');
      }}
      className="flex items-center gap-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 px-3 py-1.5 rounded-lg transition-colors"
    >
      📋 Copiar link
    </button>
  </div>
)}
```

- [ ] **Paso 2: Commit**

```bash
git add frontend/src/pages/Bookings.jsx
git commit -m "feat: add public booking link banner with copy button to dashboard"
```

---

### Tarea 16: Mejorar la página pública de reservas (BookingPage.jsx) — selector de servicio visible siempre

**El problema:** Si el negocio tiene múltiples servicios, el flujo del bot le pregunta uno por uno. En la web, el selector de servicio puede no ser obligatorio. Además, no se muestra el precio ni la duración junto al nombre del servicio.

**Archivos:**
- Modificar: `frontend/src/pages/BookingPage.jsx`

- [ ] **Paso 1: Agregar precio y duración en el selector de servicio**

```jsx
// Encontrar el <select> o botones de servicios y agregar info adicional:
// Si es un <select>:
<select name="service_id" ...>
  {services.map(s => (
    <option key={s.id} value={s.id}>
      {s.name} — {s.duration_min} min{s.price ? ` — $${Number(s.price).toLocaleString('es-CL')}` : ''}
    </option>
  ))}
</select>

// Si son botones/cards (más moderno):
{services.map(s => (
  <button
    key={s.id}
    onClick={() => setSelectedService(s.id)}
    className={`w-full text-left p-4 rounded-xl border transition-colors ${
      selectedService === s.id
        ? 'border-red-500 bg-red-500/10'
        : 'border-zinc-700 bg-zinc-800 hover:border-zinc-600'
    }`}
  >
    <div className="font-medium text-white">{s.name}</div>
    <div className="text-xs text-zinc-400 mt-0.5">
      {s.duration_min} min
      {s.price && ` · $${Number(s.price).toLocaleString('es-CL')}`}
    </div>
  </button>
))}
```

- [ ] **Paso 2: Commit**

```bash
git add frontend/src/pages/BookingPage.jsx
git commit -m "feat: show service price and duration in public booking page selector"
```

---

## Deployment de todos los cambios

### Tarea 17: Build + deploy completo

- [ ] **Paso 1: Correr tests del backend**

```bash
cd backend && npm test
# Esperado: 32 tests pasando (los existentes + ninguno roto)
```

- [ ] **Paso 2: Lint del frontend**

```bash
cd frontend && npm run lint
# Corregir cualquier error de ESLint antes de continuar
```

- [ ] **Paso 3: Build del frontend**

```bash
cd frontend && npm run build
# Esperado: dist/ generado sin errores
```

- [ ] **Paso 4: Copiar dist a backend/public para Railway**

```bash
# En la raíz del proyecto:
cp -r frontend/dist/. backend/public/
```

- [ ] **Paso 5: Commit final y push**

```bash
git add backend/public/
git commit -m "chore: rebuild frontend for Railway deployment"
git push
# Railway detecta el push y despliega automáticamente
# Vercel también despliega automáticamente desde el push
```

- [ ] **Paso 6: Verificar en producción**

```
1. Abrir https://workly.cl/dashboard → debe cargar sin errores
2. Ver skeletons mientras cargan las reservas
3. Intentar acción → debe aparecer toast (no alert nativo)
4. Verificar /health: https://saas-agendamiento-production.up.railway.app/health
   → debe retornar {"ok":true,"db":"up","uptime":...}
5. Ctrl+K en el dashboard → debe abrir buscador global
```

---

## Self-Review del Plan A

### Cobertura del spec:

| Item | Tarea |
|------|-------|
| TZ bug en validación fecha pasada | Tarea 1 ✅ |
| TZ bug en reminder job | Tarea 2 ✅ |
| alert() reemplazados | Tarea 3 ✅ |
| confirm() reemplazados | Tarea 4 ✅ |
| Retry en email/WhatsApp | Tarea 5 ✅ |
| Error boundaries React | Tarea 6 ✅ |
| Loading skeletons | Tarea 7 ✅ |
| Auto-logout en 401 | Tarea 8 ✅ |
| Health check con DB | Tarea 9 ✅ |
| UptimeRobot | Tarea 10 ✅ |
| CI/CD GitHub Actions | Tarea 11 ✅ |
| DB Backups | Tarea 12 ✅ |
| Vista mes en calendario | Tarea 13 ✅ |
| Búsqueda global Ctrl+K | Tarea 14 ✅ |
| Copiar link público | Tarea 15 ✅ |
| Precio/duración en BookingPage | Tarea 16 ✅ |
| Deploy | Tarea 17 ✅ |

**Esfuerzo estimado total:** 2–3 días de trabajo enfocado (P0: 4h, P1: 6h, P2: 4h)
