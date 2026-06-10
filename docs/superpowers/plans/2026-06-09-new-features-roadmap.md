# New Features — Plan B (P3 Roadmap)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement este plan feature por feature. Cada feature es independiente — se pueden ejecutar en cualquier orden. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar las features de mayor valor para monetización y retención de usuarios en la plataforma SaaS de agendamiento.

**Architecture:** Cada feature se implementa como un módulo independiente: nuevo controller en backend, nuevas rutas, nuevas páginas/componentes en frontend. Ninguna feature modifica las tablas existentes sin una migración explícita.

**Tech Stack:** Node.js 20, Express, pg (PostgreSQL/Neon), React 19, Vite, Tailwind CSS, PDFKit (PDFs), node-cron (jobs), whatsapp-web.js (bot existente)

**Orden recomendado por impacto/esfuerzo:**
1. Templates de mensajes (bajo esfuerzo, alto valor)
2. PDF de historial de reservas (bajo esfuerzo, alto valor)
3. Cancelación de reservas por paciente (bajo esfuerzo, necesario)
4. Bot — rescheduling y cancelaciones (medio esfuerzo, alto valor)
5. Mercado Pago (medio esfuerzo, monetización directa)
6. SMS fallback vía Twilio (medio esfuerzo)
7. Comisiones por profesional (medio esfuerzo)
8. Multi-sucursal (alto esfuerzo, enterprise)
9. Google Calendar sync (alto esfuerzo, retención alta)
10. API pública con API Keys (alto esfuerzo, developers)

---

## ══════════════════ FEATURE 1: Templates de Mensajes WhatsApp/Email ══════════════════

### Qué hace
El dueño del negocio puede editar el texto de los mensajes automáticos que se envían a los pacientes: confirmación de reserva, recordatorio 24h antes, y confirmación de cancelación. Actualmente esos mensajes están hardcodeados en el código.

### Por qué importa
- **Retención:** Cada negocio quiere personalizar el tono (formal, informal, con emoji)
- **Monetización:** Feature Pro — los negocios en plan Basic tienen mensaje genérico; Pro/Business lo personalizan
- **Tiempo:** 1 día de trabajo

### Variables disponibles en los templates
`{{clientName}}`, `{{businessName}}`, `{{serviceName}}`, `{{date}}`, `{{time}}`, `{{cancelLink}}`

### Archivos

| Archivo | Acción |
|---------|--------|
| `backend/src/db/schema.sql` | Nueva tabla `message_templates` |
| `backend/src/controllers/settings.controller.js` | CRUD de templates |
| `backend/src/routes/settings.routes.js` | Nuevas rutas GET/PUT /templates |
| `backend/src/services/email.js` | Leer template de DB antes de enviar |
| `backend/src/services/whatsapp.js` | Leer template de DB antes de enviar |
| `frontend/src/pages/Settings.jsx` | Nueva sección "Templates de mensajes" |

---

- [ ] **Paso 1: Agregar tabla en schema.sql**

```sql
-- Agregar al final de backend/src/db/schema.sql:
CREATE TABLE IF NOT EXISTS message_templates (
  id          BIGSERIAL PRIMARY KEY,
  business_id BIGINT    NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  type        TEXT      NOT NULL, -- 'booking_confirmation' | 'reminder' | 'cancellation'
  channel     TEXT      NOT NULL, -- 'whatsapp' | 'email_subject' | 'email_body'
  content     TEXT      NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(business_id, type, channel)
);
```

- [ ] **Paso 2: Correr la migración en Neon**

```bash
# En Railway console o con railway run:
node -e "
const db = require('./src/db/database');
db.query(\`
  CREATE TABLE IF NOT EXISTS message_templates (
    id BIGSERIAL PRIMARY KEY,
    business_id BIGINT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    channel TEXT NOT NULL,
    content TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(business_id, type, channel)
  )
\`).then(() => { console.log('OK'); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
"
```

- [ ] **Paso 3: Definir templates por defecto**

```js
// backend/src/services/messageTemplates.js — NUEVO ARCHIVO
const db = require('../db/database');

const DEFAULTS = {
  booking_confirmation: {
    whatsapp: `Hola {{clientName}} 👋\nTu reserva en *{{businessName}}* está confirmada.\n📅 {{date}} a las {{time}}\n💼 {{serviceName}}\n\nPara cancelar: {{cancelLink}}`,
    email_subject: `Reserva confirmada — {{businessName}}`,
    email_body: `<p>Hola <strong>{{clientName}}</strong>,</p><p>Tu reserva en <strong>{{businessName}}</strong> ha sido confirmada para el <strong>{{date}}</strong> a las <strong>{{time}}</strong>.</p><p>Servicio: {{serviceName}}</p><p><a href="{{cancelLink}}">Cancelar reserva</a></p>`,
  },
  reminder: {
    whatsapp: `Recordatorio 📅\nHola {{clientName}}, mañana tienes una cita en *{{businessName}}*\n🕐 {{date}} a las {{time}}\n💼 {{serviceName}}`,
    email_subject: `Recordatorio: cita mañana en {{businessName}}`,
    email_body: `<p>Hola <strong>{{clientName}}</strong>, te recordamos que mañana tienes una cita en <strong>{{businessName}}</strong> a las <strong>{{time}}</strong>.</p>`,
  },
  cancellation: {
    whatsapp: `Tu reserva en *{{businessName}}* del {{date}} a las {{time}} ha sido cancelada.`,
    email_subject: `Reserva cancelada — {{businessName}}`,
    email_body: `<p>Tu reserva en <strong>{{businessName}}</strong> del <strong>{{date}}</strong> ha sido cancelada.</p>`,
  },
};

/**
 * Obtiene el template para un negocio/tipo/canal.
 * Si no existe uno personalizado, retorna el default.
 */
async function getTemplate(businessId, type, channel) {
  const { rows } = await db.query(
    'SELECT content FROM message_templates WHERE business_id = $1 AND type = $2 AND channel = $3',
    [businessId, type, channel]
  );
  return rows[0]?.content || DEFAULTS[type]?.[channel] || '';
}

/**
 * Reemplaza las variables {{var}} en el template.
 */
function renderTemplate(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || '');
}

module.exports = { getTemplate, renderTemplate, DEFAULTS };
```

- [ ] **Paso 4: Usar templates en email.js**

```js
// En backend/src/services/email.js, modificar sendBookingConfirmation():
const { getTemplate, renderTemplate } = require('../lib/messageTemplates');
// O require('../services/messageTemplates') según donde lo coloques

async function sendBookingConfirmation({ clientName, clientEmail, serviceName, datetimeISO, businessName, cancelToken, businessId }) {
  if (!clientEmail) return;
  const cancelLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/cancel/${cancelToken}`;
  const date = new Date(datetimeISO).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
  const time = new Date(datetimeISO).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });

  const vars = { clientName, businessName, serviceName: serviceName || 'Sin especificar', date, time, cancelLink };

  const subject = renderTemplate(
    await getTemplate(businessId, 'booking_confirmation', 'email_subject'),
    vars
  );
  const html = renderTemplate(
    await getTemplate(businessId, 'booking_confirmation', 'email_body'),
    vars
  );
  // ... resto del código de envío existente usando subject y html
}
```

- [ ] **Paso 5: Agregar CRUD de templates en settings.controller.js**

```js
// Agregar en backend/src/controllers/settings.controller.js:
const { DEFAULTS } = require('../services/messageTemplates');

const getTemplates = async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT type, channel, content FROM message_templates WHERE business_id = $1',
      [req.business.id]
    );
    // Retornar defaults mezclados con customizados
    const result = {};
    for (const [type, channels] of Object.entries(DEFAULTS)) {
      result[type] = {};
      for (const [channel, defaultContent] of Object.entries(channels)) {
        const custom = rows.find(r => r.type === type && r.channel === channel);
        result[type][channel] = { content: custom?.content || defaultContent, customized: !!custom };
      }
    }
    res.json(result);
  } catch (err) {
    console.error('[settings] getTemplates error:', err.message);
    res.status(500).json({ error: 'Error interno' });
  }
};

const updateTemplate = async (req, res) => {
  const { type, channel, content } = req.body;
  const VALID_TYPES = ['booking_confirmation', 'reminder', 'cancellation'];
  const VALID_CHANNELS = ['whatsapp', 'email_subject', 'email_body'];
  if (!VALID_TYPES.includes(type) || !VALID_CHANNELS.includes(channel)) {
    return res.status(400).json({ error: 'type o channel inválido' });
  }
  if (!content || typeof content !== 'string' || content.length > 2000) {
    return res.status(400).json({ error: 'content inválido (max 2000 chars)' });
  }
  try {
    await db.query(`
      INSERT INTO message_templates (business_id, type, channel, content, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (business_id, type, channel) DO UPDATE SET content = $4, updated_at = NOW()
    `, [req.business.id, type, channel, content]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[settings] updateTemplate error:', err.message);
    res.status(500).json({ error: 'Error interno' });
  }
};
```

- [ ] **Paso 6: Agregar rutas en settings.routes.js**

```js
router.get('/templates', auth, getTemplates);
router.put('/templates', auth, updateTemplate);
```

- [ ] **Paso 7: UI en Settings.jsx — sección "Mensajes automáticos"**

```jsx
// Nueva sección en la página de configuración:
// Mostrar cada template como un textarea editable con preview de variables
// Botón "Restaurar default" para cada uno

// Ejemplo de un bloque:
<div className="space-y-4">
  <h3 className="text-white font-medium">Confirmación de reserva</h3>
  <div>
    <label className="text-xs text-zinc-400 mb-1 block">Mensaje WhatsApp</label>
    <textarea
      value={templates.booking_confirmation?.whatsapp?.content || ''}
      onChange={e => updateLocal('booking_confirmation', 'whatsapp', e.target.value)}
      rows={4}
      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500 font-mono"
    />
    <p className="text-xs text-zinc-500 mt-1">
      Variables: &#123;&#123;clientName&#125;&#125; &#123;&#123;businessName&#125;&#125; &#123;&#123;serviceName&#125;&#125; &#123;&#123;date&#125;&#125; &#123;&#123;time&#125;&#125; &#123;&#123;cancelLink&#125;&#125;
    </p>
  </div>
</div>
```

- [ ] **Paso 8: Test e2e manual**

```
1. Ir a /dashboard/configuracion → sección mensajes
2. Cambiar el template de confirmación
3. Hacer una reserva de prueba
4. Verificar que el mensaje llega con el texto editado
```

- [ ] **Paso 9: Commit**

```bash
git add backend/src/services/messageTemplates.js \
        backend/src/controllers/settings.controller.js \
        backend/src/routes/settings.routes.js \
        backend/src/services/email.js \
        backend/src/db/schema.sql \
        frontend/src/pages/Settings.jsx
git commit -m "feat: editable message templates for WhatsApp and email notifications"
```

---

## ══════════════════ FEATURE 2: PDF de Historial de Reservas ══════════════════

### Qué hace
El dueño del negocio puede descargar un PDF con su historial de reservas (filtrado por fecha), o el historial clínico de un paciente específico. El PDF tiene el logo/nombre del negocio, tabla de reservas, y un resumen estadístico.

### Por qué importa
- **Retención:** Los contadores y fisioterapeutas necesitan reportes para facturar y cumplir normativa
- **Monetización:** Feature Business — solo plan Business descarga PDFs
- **Tiempo:** 1–2 días de trabajo

### Dependencias
```bash
cd backend && npm install pdfkit
```

### Archivos

| Archivo | Acción |
|---------|--------|
| `backend/src/controllers/reports.controller.js` | NUEVO: genera PDF |
| `backend/src/routes/reports.routes.js` | NUEVO: rutas GET /reports/bookings y /reports/patient/:id |
| `backend/src/index.js` | Registrar rutas de reports |
| `frontend/src/pages/Analytics.jsx` | Botón "Descargar PDF" |
| `frontend/src/pages/PatientDetail.jsx` | Botón "Descargar historial clínico" |

---

- [ ] **Paso 1: Instalar pdfkit**

```bash
cd backend && npm install pdfkit
```

- [ ] **Paso 2: Crear reports.controller.js**

```js
// backend/src/controllers/reports.controller.js
const PDFDocument = require('pdfkit');
const db = require('../db/database');

const bookingsReport = async (req, res) => {
  const { from, to } = req.query;
  // Default: mes actual
  const fromDate = from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const toDate = to || new Date().toISOString().slice(0, 10);

  try {
    const { rows: biz } = await db.query('SELECT * FROM businesses WHERE id = $1', [req.business.id]);
    const business = biz[0];

    const { rows: bookings } = await db.query(`
      SELECT b.*, s.name as service_name
      FROM bookings b
      LEFT JOIN services s ON b.service_id = s.id
      WHERE b.business_id = $1
        AND LEFT(b.datetime_iso, 10) >= $2
        AND LEFT(b.datetime_iso, 10) <= $3
        AND b.status != 'cancelled'
      ORDER BY b.datetime_iso ASC
    `, [req.business.id, fromDate, toDate]);

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="reservas-${fromDate}-${toDate}.pdf"`);
    doc.pipe(res);

    // Encabezado
    doc.fontSize(20).font('Helvetica-Bold').text(business.name, { align: 'left' });
    doc.fontSize(10).font('Helvetica').fillColor('#666').text(`Reporte de reservas: ${fromDate} al ${toDate}`, { align: 'left' });
    doc.moveDown();

    // Resumen
    const total = bookings.length;
    const completed = bookings.filter(b => b.status === 'completed').length;
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#000').text('Resumen');
    doc.fontSize(10).font('Helvetica').text(`Total reservas: ${total}`);
    doc.text(`Completadas: ${completed}`);
    doc.text(`Tasa asistencia: ${total > 0 ? Math.round(completed/total*100) : 0}%`);
    doc.moveDown();

    // Tabla
    doc.fontSize(12).font('Helvetica-Bold').text('Detalle de Reservas');
    doc.moveDown(0.5);

    const colX = [50, 160, 280, 370, 460];
    const headers = ['Fecha/Hora', 'Cliente', 'Servicio', 'Teléfono', 'Estado'];

    // Cabecera tabla
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#fff');
    doc.rect(50, doc.y, 495, 16).fill('#333').stroke();
    headers.forEach((h, i) => {
      doc.fillColor('#fff').text(h, colX[i], doc.y - 13, { width: 100 });
    });
    doc.fillColor('#000').moveDown(0.5);

    // Filas
    bookings.forEach((b, idx) => {
      if (doc.y > 720) { doc.addPage(); }
      const y = doc.y;
      if (idx % 2 === 0) doc.rect(50, y, 495, 14).fill('#f5f5f5').stroke();
      const dateStr = new Date(b.datetime_iso).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
      const row = [dateStr, b.client_name, b.service_name || '—', b.client_phone || '—', b.status];
      doc.fontSize(8).font('Helvetica').fillColor('#000');
      row.forEach((val, i) => {
        doc.text(val?.slice(0, 20) || '', colX[i], y + 2, { width: 100 });
      });
      doc.moveDown(0.3);
    });

    doc.end();
  } catch (err) {
    console.error('[reports] bookingsReport error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Error generando PDF' });
  }
};

const patientReport = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows: patients } = await db.query(
      'SELECT * FROM patients WHERE id = $1 AND business_id = $2',
      [id, req.business.id]
    );
    if (!patients[0]) return res.status(404).json({ error: 'Paciente no encontrado' });
    const patient = patients[0];

    const { rows: bookings } = await db.query(`
      SELECT b.*, s.name as service_name
      FROM bookings b
      LEFT JOIN services s ON b.service_id = s.id
      WHERE b.patient_id = $1
      ORDER BY b.datetime_iso DESC
    `, [id]);

    const { rows: consultations } = await db.query(`
      SELECT c.*, pr.name as professional_name
      FROM consultations c
      LEFT JOIN professionals pr ON c.professional_id = pr.id
      WHERE c.patient_id = $1
      ORDER BY c.created_at DESC
    `, [id]);

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="paciente-${patient.rut}.pdf"`);
    doc.pipe(res);

    doc.fontSize(18).font('Helvetica-Bold').text('Historial Clínico del Paciente');
    doc.fontSize(10).font('Helvetica').fillColor('#666').text(`Generado el ${new Date().toLocaleDateString('es-CL')}`);
    doc.moveDown();

    doc.fontSize(12).font('Helvetica-Bold').fillColor('#000').text('Datos del Paciente');
    doc.fontSize(10).font('Helvetica');
    doc.text(`Nombre: ${patient.name}`);
    doc.text(`RUT: ${patient.rut}`);
    if (patient.phone) doc.text(`Teléfono: ${patient.phone}`);
    if (patient.birth_date) doc.text(`Fecha de nacimiento: ${patient.birth_date}`);
    if (patient.allergies) doc.text(`Alergias: ${patient.allergies}`);
    doc.moveDown();

    if (consultations.length > 0) {
      doc.fontSize(12).font('Helvetica-Bold').text('Consultas');
      consultations.forEach(c => {
        doc.moveDown(0.3);
        doc.fontSize(9).font('Helvetica-Bold').text(new Date(c.created_at).toLocaleDateString('es-CL'));
        if (c.professional_name) doc.fontSize(8).font('Helvetica').text(`Profesional: ${c.professional_name}`);
        if (c.diagnosis) doc.text(`Diagnóstico: ${c.diagnosis}`);
        if (c.notes) doc.text(`Notas: ${c.notes}`);
      });
      doc.moveDown();
    }

    if (bookings.length > 0) {
      doc.fontSize(12).font('Helvetica-Bold').text('Reservas');
      bookings.slice(0, 20).forEach(b => {
        const date = new Date(b.datetime_iso).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
        doc.fontSize(9).font('Helvetica').text(`${date} — ${b.service_name || 'Sin servicio'} — ${b.status}`);
      });
    }

    doc.end();
  } catch (err) {
    console.error('[reports] patientReport error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Error generando PDF' });
  }
};

module.exports = { bookingsReport, patientReport };
```

- [ ] **Paso 3: Crear reports.routes.js**

```js
// backend/src/routes/reports.routes.js
const { Router } = require('express');
const auth = require('../middleware/auth');
const { requirePlan } = require('../middleware/plan');
const { bookingsReport, patientReport } = require('../controllers/reports.controller');

const router = Router();
router.get('/bookings', auth, requirePlan('pro'), bookingsReport);
router.get('/patient/:id', auth, requirePlan('pro'), patientReport);
module.exports = router;
```

- [ ] **Paso 4: Registrar en index.js**

```js
// En backend/src/index.js, junto a las demás rutas:
const reportsRoutes = require('./routes/reports.routes');
app.use('/api/reports', reportsRoutes);
```

- [ ] **Paso 5: Botón en Analytics.jsx**

```jsx
// Agregar junto a los filtros de fecha:
<button
  onClick={() => {
    const url = `/api/reports/bookings?from=${from}&to=${to}`;
    window.open(url, '_blank');
  }}
  className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 px-4 py-2 rounded-xl text-sm transition-colors"
>
  📄 Descargar PDF
</button>
```

- [ ] **Paso 6: Botón en PatientDetail.jsx**

```jsx
<button
  onClick={() => window.open(`/api/reports/patient/${patient.id}`, '_blank')}
  className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 px-3 py-2 rounded-xl text-sm transition-colors"
>
  📄 Historial PDF
</button>
```

- [ ] **Paso 7: Test manual**

```
1. Ir a /dashboard/analytics
2. Seleccionar rango de fechas
3. Clic "Descargar PDF" → debe abrirse PDF con tabla de reservas
4. Ir a /dashboard/paciente/1
5. Clic "Historial PDF" → debe abrirse PDF con datos del paciente
```

- [ ] **Paso 8: Commit**

```bash
cd backend && npm install pdfkit
git add backend/src/controllers/reports.controller.js \
        backend/src/routes/reports.routes.js \
        backend/src/index.js \
        backend/package.json backend/package-lock.json \
        frontend/src/pages/Analytics.jsx \
        frontend/src/pages/PatientDetail.jsx
git commit -m "feat: PDF report generation for bookings and patient history"
```

---

## ══════════════════ FEATURE 3: Cancelación de Reservas por el Paciente ══════════════════

### Qué hace
Cuando se confirma una reserva, el paciente recibe un link único (ya existe `cancel_token` en la DB). Al abrirlo, ve la info de su reserva y puede cancelarla con un clic. Actualmente el token se genera pero la página de cancelación no existe.

### Por qué importa
- **Operacional:** Sin esto, los pacientes cancelan por WhatsApp y el negocio tiene que actualizar manualmente
- **Automatización:** Libera el slot para que otro paciente reserve
- **Tiempo:** 4 horas

### Archivos

| Archivo | Acción |
|---------|--------|
| `backend/src/routes/public.routes.js` | Nueva ruta GET/POST /cancel/:token |
| `backend/src/controllers/bookings.controller.js` | Nueva función cancelByToken |
| `frontend/src/pages/CancelBookingPage.jsx` | EXISTE: verificar si está completa |
| `frontend/src/App.jsx` | Verificar ruta /cancel/:token |

---

- [ ] **Paso 1: Verificar si ya existe la página de cancelación**

```bash
cat frontend/src/pages/CancelBookingPage.jsx
# Si ya existe y tiene funcionalidad, saltar al paso 3
```

- [ ] **Paso 2: Crear/completar CancelBookingPage.jsx si falta**

```jsx
// frontend/src/pages/CancelBookingPage.jsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export default function CancelBookingPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | found | cancelled | error

  useEffect(() => {
    fetch(`/api/public/cancel/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.booking) { setBooking(data.booking); setStatus('found'); }
        else if (data.already_cancelled) setStatus('cancelled');
        else setStatus('error');
      })
      .catch(() => setStatus('error'));
  }, [token]);

  const doCancel = async () => {
    const r = await fetch(`/api/public/cancel/${token}`, { method: 'POST' });
    const data = await r.json();
    if (data.ok) setStatus('cancelled');
    else setStatus('error');
  };

  if (status === 'loading') return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-zinc-400">Cargando...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 max-w-md w-full">
        {status === 'found' && booking && (
          <>
            <h1 className="text-xl font-bold text-white mb-2">Cancelar reserva</h1>
            <p className="text-zinc-400 text-sm mb-6">¿Quieres cancelar esta reserva?</p>
            <div className="bg-zinc-800 rounded-xl p-4 mb-6 space-y-2">
              <p className="text-white font-medium">{booking.client_name}</p>
              <p className="text-zinc-400 text-sm">{new Date(booking.datetime_iso).toLocaleString('es-CL', { dateStyle: 'full', timeStyle: 'short' })}</p>
              {booking.service_name && <p className="text-zinc-400 text-sm">{booking.service_name}</p>}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => navigate('/')}
                className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 text-sm hover:bg-zinc-800 transition-colors"
              >
                No cancelar
              </button>
              <button
                onClick={doCancel}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
              >
                Sí, cancelar
              </button>
            </div>
          </>
        )}
        {status === 'cancelled' && (
          <>
            <div className="text-4xl mb-4 text-center">✓</div>
            <h1 className="text-xl font-bold text-white text-center mb-2">Reserva cancelada</h1>
            <p className="text-zinc-400 text-sm text-center">Tu reserva ha sido cancelada. El negocio ha sido notificado.</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="text-4xl mb-4 text-center">⚠️</div>
            <h1 className="text-xl font-bold text-white text-center mb-2">Link inválido o expirado</h1>
            <p className="text-zinc-400 text-sm text-center">No pudimos encontrar esta reserva. Puede que ya haya sido cancelada.</p>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Paso 3: Agregar endpoint en backend (public.routes.js)**

```js
// En backend/src/routes/public.routes.js o controllers/bookings.controller.js:

// GET /api/public/cancel/:token — ver info de la reserva
const getCancelInfo = async (req, res) => {
  const { token } = req.params;
  try {
    const { rows } = await db.query(`
      SELECT b.id, b.client_name, b.datetime_iso, b.status, s.name as service_name
      FROM bookings b
      LEFT JOIN services s ON b.service_id = s.id
      WHERE b.cancel_token = $1
    `, [token]);
    if (!rows[0]) return res.status(404).json({ error: 'Reserva no encontrada' });
    if (rows[0].status === 'cancelled') return res.json({ already_cancelled: true });
    res.json({ booking: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
};

// POST /api/public/cancel/:token — cancelar
const cancelByToken = async (req, res) => {
  const { token } = req.params;
  try {
    const { rows } = await db.query(
      "UPDATE bookings SET status = 'cancelled' WHERE cancel_token = $1 AND status != 'cancelled' RETURNING id, client_name, business_id",
      [token]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Reserva no encontrada o ya cancelada' });

    // Notificar al negocio por email
    const { rows: biz } = await db.query('SELECT owner_email, name FROM businesses WHERE id = $1', [rows[0].business_id]);
    if (biz[0]?.owner_email) {
      // Llamar al servicio de email (no bloqueante)
      sendBusinessCancellation({ ... }).catch(console.error);
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
};
```

- [ ] **Paso 4: Verificar ruta en App.jsx**

```jsx
// Buscar en App.jsx si existe:
// <Route path="/cancel/:token" element={<CancelBookingPage />} />
// Si no existe, agregarla junto a las otras rutas públicas
```

- [ ] **Paso 5: Test manual**

```
1. Hacer una reserva de prueba → anotar el cancel_token de la respuesta
2. Ir a http://localhost:5173/cancel/{token}
3. Debe aparecer la info de la reserva
4. Clic "Sí, cancelar" → estado debe cambiar a cancelado en la DB
```

- [ ] **Paso 6: Commit**

```bash
git add frontend/src/pages/CancelBookingPage.jsx \
        backend/src/routes/public.routes.js \
        backend/src/controllers/bookings.controller.js
git commit -m "feat: patient self-service booking cancellation via unique token link"
```

---

## ══════════════════ FEATURE 4: Bot — Rescheduling y Cancelaciones ══════════════════

### Qué hace
El bot de WhatsApp actualmente solo permite agendar. Si un paciente escribe "quiero cambiar mi cita" o "quiero cancelar", el bot no sabe qué hacer. Este feature agrega dos flujos nuevos al bot: reprogramar una cita existente y cancelarla.

### Por qué importa
- **Retención bot:** Sin esto, el bot es útil solo para reservar, no para gestionar
- **Reducción de no-shows:** Los pacientes que quieren cancelar pero no pueden, simplemente no van
- **Tiempo:** 2 días

### Flujo de reprogramación
```
Paciente: "quiero cambiar mi cita"
Bot: "¿Cuál es tu RUT o teléfono para buscar tu reserva?"
Paciente: "12.345.678-9"
Bot: "Encontré tu cita para el [fecha]. ¿Qué nueva fecha quieres? 
      1. Lunes 12 junio — 09:00, 10:00, 11:00
      2. Martes 13 junio — ..."
Paciente: "1" o "Lunes"
Bot: "¿A qué hora?" (si hay más de un slot ese día)
Paciente: "10:00"
Bot: "✓ Cita reprogramada para el Lunes 12 junio a las 10:00"
```

### Archivos

| Archivo | Acción |
|---------|--------|
| `whatsapp-bot/src/handlers/reschedule.handler.js` | NUEVO: flujo de reprogramación |
| `whatsapp-bot/src/handlers/cancel.handler.js` | NUEVO: flujo de cancelación |
| `whatsapp-bot/src/core/router.js` | Detectar intención de cambio/cancelación |
| `whatsapp-bot/src/handlers/menu.handler.js` | Agregar opción "3. Cambiar cita" y "4. Cancelar cita" al menú |

---

- [ ] **Paso 1: Agregar opciones al menú principal del bot**

```js
// En whatsapp-bot/src/handlers/menu.handler.js, en el texto del menú:
// ANTES: "1. Agendar cita\n2. Consultar mis citas"
// DESPUÉS:
const MENU_TEXT = `Hola 👋 ¿En qué puedo ayudarte?

1️⃣ Agendar cita
2️⃣ Ver mis citas
3️⃣ Cambiar una cita
4️⃣ Cancelar una cita

Escribe el número de la opción que deseas.`;
```

- [ ] **Paso 2: Crear cancel.handler.js**

```js
// whatsapp-bot/src/handlers/cancel.handler.js
const STATES = {
  ASKING_RUT: 'cancel_asking_rut',
  CONFIRMING: 'cancel_confirming',
};

async function fetchBookingByRut(saasUrl, slug, rut, token) {
  // GET /api/bookings?client_rut={rut}&status=confirmed&limit=5
  const resp = await fetch(`${saasUrl}/api/bookings?client_rut=${encodeURIComponent(rut)}&status=confirmed&limit=5`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!resp.ok) return [];
  const data = await resp.json();
  return data.bookings || [];
}

async function cancelBooking(saasUrl, bookingId, token) {
  const resp = await fetch(`${saasUrl}/api/bookings/${bookingId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status: 'cancelled' }),
  });
  return resp.ok;
}

module.exports = {
  STATES,
  async handle(ctx, session, config) {
    const { message, saasUrl, slug, apiToken } = ctx;
    const text = message.trim();

    if (session.state === STATES.ASKING_RUT) {
      // Buscar reservas por RUT
      const bookings = await fetchBookingByRut(saasUrl, slug, text, apiToken);
      if (!bookings.length) {
        session.state = null;
        return 'No encontré reservas confirmadas con ese RUT. ¿Deseas agendar una nueva cita? Escribe *hola* para volver al menú.';
      }
      // Si hay una sola, pedir confirmación directa
      const b = bookings[0];
      const date = new Date(b.datetime_iso).toLocaleString('es-CL', { dateStyle: 'full', timeStyle: 'short' });
      session.state = STATES.CONFIRMING;
      session.pendingCancelId = b.id;
      return `Encontré esta reserva:\n📅 ${date}\n💼 ${b.service_name || 'Sin especificar'}\n\n¿Confirmas que quieres cancelarla?\n1. Sí, cancelar\n2. No, volver al menú`;
    }

    if (session.state === STATES.CONFIRMING) {
      if (text === '1' || text.toLowerCase().includes('si') || text.toLowerCase().includes('sí')) {
        const ok = await cancelBooking(saasUrl, session.pendingCancelId, apiToken);
        session.state = null;
        session.pendingCancelId = null;
        if (ok) return '✅ Tu reserva ha sido cancelada. Si necesitas otra cosa, escribe *hola*.';
        return '❌ No pude cancelar la reserva. Por favor comunícate directamente con el negocio.';
      }
      session.state = null;
      return 'Cancelación abortada. Escribe *hola* para volver al menú.';
    }

    // Inicio del flujo
    session.state = STATES.ASKING_RUT;
    return '¿Cuál es tu RUT? (Formato: 12.345.678-9)\nLo usaré para buscar tu reserva.';
  }
};
```

- [ ] **Paso 3: Actualizar router.js para detectar las nuevas intenciones**

```js
// En whatsapp-bot/src/core/router.js, en la detección de intención:
const CANCEL_KEYWORDS = ['cancelar', 'cancel', 'anular', 'borrar cita', '4'];
const RESCHEDULE_KEYWORDS = ['cambiar', 'mover', 'reprogramar', 'cambio', '3', 'otro dia', 'otro día'];

// Si el mensaje contiene alguna de estas palabras:
if (CANCEL_KEYWORDS.some(k => normalizedMsg.includes(k))) {
  session.currentHandler = 'cancel';
  return cancelHandler.handle(ctx, session, config);
}
if (RESCHEDULE_KEYWORDS.some(k => normalizedMsg.includes(k))) {
  session.currentHandler = 'reschedule';
  return rescheduleHandler.handle(ctx, session, config);
}
```

- [ ] **Paso 4: Test manual con WhatsApp**

```
1. Enviar "cancelar" al bot
2. Bot responde pidiendo RUT
3. Enviar RUT del cliente de prueba
4. Bot muestra la reserva y pide confirmación
5. Enviar "1"
6. Verificar en el SaaS dashboard que la reserva cambió a "cancelled"
```

- [ ] **Paso 5: Commit**

```bash
git add whatsapp-bot/src/handlers/cancel.handler.js \
        whatsapp-bot/src/handlers/reschedule.handler.js \
        whatsapp-bot/src/core/router.js \
        whatsapp-bot/src/handlers/menu.handler.js
git commit -m "feat: bot can now handle booking cancellations via WhatsApp"
```

---

## ══════════════════ FEATURE 5: Pagos con Mercado Pago ══════════════════

### Qué hace
El paciente puede pagar su consulta al momento de reservar en la página pública. El negocio en plan Business puede activar el cobro previo. Se integra Mercado Pago (dominante en Chile/Latam) como alternativa o reemplazo de Stripe.

### Por qué importa
- **Monetización directa:** El SaaS cobra un % de cada pago procesado (modelo marketplace) o cobra la plataforma MP directamente al negocio
- **Reducción no-shows:** Los pacientes que ya pagaron tienen ~70% menos ausentismo
- **Relevancia local:** Mercado Pago tiene mayor penetración en Chile que Stripe
- **Tiempo:** 3–4 días

### Dependencias
```bash
cd backend && npm install mercadopago
```

### Archivos

| Archivo | Acción |
|---------|--------|
| `backend/src/controllers/payments.controller.js` | NUEVO: crear preferencia de pago, webhook |
| `backend/src/routes/payments.routes.js` | NUEVO: rutas de pago |
| `backend/src/db/schema.sql` | Nueva tabla `payments` |
| `frontend/src/pages/BookingPage.jsx` | Opción "Pagar ahora" vs "Pagar en la consulta" |
| `frontend/src/pages/Settings.jsx` | Sección para conectar cuenta Mercado Pago |
| `backend/.env.example` | Agregar MP_ACCESS_TOKEN |

---

- [ ] **Paso 1: Crear tabla payments**

```sql
-- Agregar a schema.sql:
CREATE TABLE IF NOT EXISTS payments (
  id              BIGSERIAL PRIMARY KEY,
  business_id     BIGINT    NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  booking_id      BIGINT    REFERENCES bookings(id),
  mp_preference_id TEXT,
  mp_payment_id   TEXT,
  amount          NUMERIC   NOT NULL,
  currency        TEXT      NOT NULL DEFAULT 'CLP',
  status          TEXT      NOT NULL DEFAULT 'pending', -- pending | approved | rejected | cancelled
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);
```

- [ ] **Paso 2: Instalar SDK**

```bash
cd backend && npm install mercadopago
```

- [ ] **Paso 3: Crear payments.controller.js**

```js
// backend/src/controllers/payments.controller.js
const { MercadoPagoConfig, Preference } = require('mercadopago');
const db = require('../db/database');

// Inicializar solo si está configurado
function getMP(accessToken) {
  if (!accessToken) throw new Error('Mercado Pago no configurado');
  return new MercadoPagoConfig({ accessToken });
}

const createPreference = async (req, res) => {
  const { booking_id, service_id, amount, client_email } = req.body;

  try {
    // Obtener configuración de MP del negocio (guardada en settings)
    const { rows: settings } = await db.query(
      "SELECT value FROM business_settings WHERE business_id = $1 AND key = 'mp_access_token'",
      [req.business.id]
    );
    const mpToken = settings[0]?.value;
    const client = getMP(mpToken);
    const preference = new Preference(client);

    const { rows: svc } = await db.query('SELECT name FROM services WHERE id = $1', [service_id]);
    const serviceName = svc[0]?.name || 'Consulta';

    const result = await preference.create({
      body: {
        items: [{
          title: serviceName,
          quantity: 1,
          unit_price: Number(amount),
          currency_id: 'CLP',
        }],
        payer: { email: client_email },
        back_urls: {
          success: `${process.env.FRONTEND_URL}/book/${req.business.slug}?payment=success`,
          failure: `${process.env.FRONTEND_URL}/book/${req.business.slug}?payment=failure`,
          pending: `${process.env.FRONTEND_URL}/book/${req.business.slug}?payment=pending`,
        },
        auto_return: 'approved',
        notification_url: `${process.env.BACKEND_URL || 'https://saas-agendamiento-production.up.railway.app'}/api/payments/webhook`,
        external_reference: booking_id?.toString(),
      }
    });

    // Guardar en DB
    await db.query(
      'INSERT INTO payments (business_id, booking_id, mp_preference_id, amount) VALUES ($1, $2, $3, $4)',
      [req.business.id, booking_id || null, result.id, amount]
    );

    res.json({ preference_id: result.id, init_point: result.init_point });
  } catch (err) {
    console.error('[payments] createPreference error:', err.message);
    res.status(500).json({ error: 'Error creando preferencia de pago' });
  }
};

const webhook = async (req, res) => {
  const { type, data } = req.body;
  if (type !== 'payment') return res.json({ ok: true });

  try {
    // Actualizar estado del pago en DB
    // En producción: verificar firma del webhook con MP_WEBHOOK_SECRET
    await db.query(
      "UPDATE payments SET status = $1, mp_payment_id = $2 WHERE mp_preference_id = $3",
      ['approved', data.id, req.query['data.id']] // simplificado
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[payments] webhook error:', err.message);
    res.status(500).json({ error: 'Error procesando webhook' });
  }
};

module.exports = { createPreference, webhook };
```

- [ ] **Paso 4: Crear routes y registrar**

```js
// backend/src/routes/payments.routes.js
const { Router } = require('express');
const auth = require('../middleware/auth');
const { createPreference, webhook } = require('../controllers/payments.controller');
const router = Router();
router.post('/preference', auth, createPreference);
router.post('/webhook', webhook); // sin auth, webhook de MP
module.exports = router;

// En index.js:
app.use('/api/payments', require('./routes/payments.routes'));
```

- [ ] **Paso 5: Opción de pago en BookingPage.jsx**

```jsx
// Después de confirmar la reserva, si el negocio tiene MP configurado:
{business.mp_enabled && selectedService?.price && (
  <div className="mt-4 space-y-3">
    <p className="text-sm text-zinc-400">¿Cómo prefieres pagar?</p>
    <button
      onClick={handlePayNow}
      className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
    >
      💳 Pagar ahora — ${Number(selectedService.price).toLocaleString('es-CL')}
    </button>
    <button
      onClick={handlePayLater}
      className="w-full py-3 bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 rounded-xl font-medium transition-colors"
    >
      📍 Pagar en la consulta
    </button>
  </div>
)}

// handlePayNow crea la reserva y luego redirige al init_point de MP:
const handlePayNow = async () => {
  const booking = await createBooking(); // función existente
  const { data } = await fetch('/api/payments/preference', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      booking_id: booking.booking_id,
      service_id: selectedService.id,
      amount: selectedService.price,
      client_email: formData.client_email,
    }),
  }).then(r => r.json());
  window.location.href = data.init_point; // redirigir a MP
};
```

- [ ] **Paso 6: Sección en Settings.jsx para conectar MP**

```jsx
// En la pestaña de configuración:
<div className="space-y-4">
  <h3 className="text-white font-medium">Mercado Pago</h3>
  <p className="text-zinc-400 text-sm">
    Conecta tu cuenta de Mercado Pago para recibir pagos al momento de la reserva.
    <a href="https://www.mercadopago.cl/developers/es/docs" target="_blank" rel="noreferrer" className="text-red-400 ml-1">
      Ver documentación
    </a>
  </p>
  <div>
    <label className="text-sm text-zinc-400">Access Token (Producción)</label>
    <input
      type="password"
      value={mpToken}
      onChange={e => setMpToken(e.target.value)}
      placeholder="APP_USR-..."
      className={inputClass}
    />
  </div>
  <div className="flex items-center gap-3">
    <label className="text-sm text-white">Cobro previo obligatorio</label>
    <input type="checkbox" checked={mpRequired} onChange={e => setMpRequired(e.target.checked)} />
  </div>
  <button onClick={saveMpSettings} className={btnClass}>Guardar configuración MP</button>
</div>
```

- [ ] **Paso 7: Test con MP Sandbox**

```
1. Crear cuenta en https://www.mercadopago.cl/developers
2. Obtener Access Token de prueba (TEST-xxx)
3. Configurarlo en Settings
4. Hacer una reserva de prueba → seleccionar "Pagar ahora"
5. Debe redirigir a MP con el precio correcto
6. Pagar con tarjeta de prueba de MP
7. Verificar que el estado del pago en la DB cambia a 'approved'
```

- [ ] **Paso 8: Commit**

```bash
git add backend/src/controllers/payments.controller.js \
        backend/src/routes/payments.routes.js \
        backend/src/index.js \
        backend/src/db/schema.sql \
        backend/package.json backend/package-lock.json \
        frontend/src/pages/BookingPage.jsx \
        frontend/src/pages/Settings.jsx
git commit -m "feat: Mercado Pago payment integration for pre-paid bookings"
```

---

## ══════════════════ FEATURE 6: SMS fallback con Twilio ══════════════════

### Qué hace
Si el paciente no tiene WhatsApp, las notificaciones se envían por SMS en su lugar. El sistema detecta si el número del paciente tiene WhatsApp (usando Twilio Lookup) y elige el canal adecuado automáticamente.

### Por qué importa
- **Cobertura:** Chile tiene ~78% de penetración de WhatsApp, pero el 22% restante pierde notificaciones
- **Confiabilidad:** SMS tiene tasa de entrega ~99% vs WhatsApp que puede fallar
- **Tiempo:** 1–2 días

### Dependencias
```bash
cd backend && npm install twilio
```

### Variables de entorno
```
TWILIO_ACCOUNT_SID=ACxxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_SMS_FROM=+56922222222  (número Twilio)
# TWILIO_WHATSAPP_FROM ya existe para el reminder service
```

### Archivos

| Archivo | Acción |
|---------|--------|
| `backend/src/services/sms.js` | NUEVO: servicio SMS via Twilio |
| `backend/src/services/notifications.js` | NUEVO: orquestador que elige WhatsApp vs SMS |
| `backend/src/controllers/bookings.controller.js` | Usar notifications.js en lugar de whatsapp.js directo |
| `backend/src/jobs/reminders.js` | Usar notifications.js |

---

- [ ] **Paso 1: Instalar Twilio**

```bash
cd backend && npm install twilio
```

- [ ] **Paso 2: Crear sms.js**

```js
// backend/src/services/sms.js
const twilio = require('twilio');

function getSMSClient() {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) return null;
  return twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
}

async function sendSMS({ to, body }) {
  const client = getSMSClient();
  if (!client) {
    console.warn('[sms] Twilio no configurado, SMS no enviado');
    return;
  }
  const from = process.env.TWILIO_SMS_FROM;
  if (!from) throw new Error('TWILIO_SMS_FROM no configurado');

  // Normalizar número chileno: 9XXXXXXXX → +569XXXXXXXX
  let normalizedTo = to?.replace(/\s/g, '');
  if (normalizedTo && !normalizedTo.startsWith('+')) {
    if (normalizedTo.startsWith('9') && normalizedTo.length === 9) {
      normalizedTo = `+56${normalizedTo}`;
    } else if (normalizedTo.startsWith('56')) {
      normalizedTo = `+${normalizedTo}`;
    }
  }

  await client.messages.create({ body, from, to: normalizedTo });
  console.log(`[sms] SMS enviado a ${normalizedTo}`);
}

module.exports = { sendSMS };
```

- [ ] **Paso 3: Crear notifications.js como orquestador**

```js
// backend/src/services/notifications.js
const { notifyBooking: notifyBookingWA, notifyReminder: notifyReminderWA } = require('./whatsapp');
const { sendSMS } = require('./sms');

/**
 * Envía confirmación de reserva por el canal disponible (WhatsApp preferido, SMS fallback).
 * La lógica es simple: si Twilio WA está configurado, usar WA; si no, SMS.
 * En el futuro: Twilio Lookup para detectar si el número tiene WA.
 */
async function notifyBookingConfirmation({ clientName, clientPhone, clientEmail, serviceName, datetimeISO, businessName }) {
  const hasWA = !!(process.env.TWILIO_WHATSAPP_FROM);
  const hasSMS = !!(process.env.TWILIO_SMS_FROM);

  if (hasWA) {
    await notifyBookingWA({ clientName, clientPhone, clientEmail, serviceName, datetimeISO, businessName });
  } else if (hasSMS && clientPhone) {
    const date = new Date(datetimeISO).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
    await sendSMS({
      to: clientPhone,
      body: `Reserva confirmada en ${businessName}. ${date}. Servicio: ${serviceName || 'Sin especificar'}.`,
    });
  }
}

async function notifyReminder({ clientName, clientPhone, clientEmail, serviceName, datetimeISO, businessName }) {
  const hasWA = !!(process.env.TWILIO_WHATSAPP_FROM);
  const hasSMS = !!(process.env.TWILIO_SMS_FROM);

  if (hasWA) {
    await notifyReminderWA({ clientName, clientPhone, clientEmail, serviceName, datetimeISO, businessName });
  } else if (hasSMS && clientPhone) {
    const date = new Date(datetimeISO).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
    await sendSMS({
      to: clientPhone,
      body: `Recordatorio: tienes cita mañana en ${businessName} a las ${date.split(', ')[1]}.`,
    });
  }
}

module.exports = { notifyBookingConfirmation, notifyReminder };
```

- [ ] **Paso 4: Actualizar bookings.controller.js y reminders.js para usar el orquestador**

```js
// En bookings.controller.js, reemplazar:
// const { notifyBooking } = require('../services/whatsapp');
// Por:
const { notifyBookingConfirmation } = require('../services/notifications');
// Y cambiar la llamada de notifyBooking({...}) a notifyBookingConfirmation({...})

// En reminders.js, reemplazar:
// const { notifyReminder } = require('../services/whatsapp');
// Por:
const { notifyReminder } = require('../services/notifications');
```

- [ ] **Paso 5: Commit**

```bash
git add backend/src/services/sms.js \
        backend/src/services/notifications.js \
        backend/src/controllers/bookings.controller.js \
        backend/src/jobs/reminders.js \
        backend/package.json backend/package-lock.json
git commit -m "feat: SMS fallback via Twilio when WhatsApp is unavailable"
```

---

## ══════════════════ FEATURE 7: Comisiones por Profesional ══════════════════

### Qué hace
El negocio puede definir un porcentaje o monto fijo de comisión por profesional. En el módulo de analytics, se muestra cuánto le corresponde a cada profesional según las consultas completadas del período.

### Por qué importa
- **Retención:** Las clínicas necesitan calcular sueldos variables; actualmente lo hacen manualmente en Excel
- **Plan Business:** Feature exclusivo Business, agrega valor tangible al upgrade
- **Tiempo:** 1–2 días

### Archivos

| Archivo | Acción |
|---------|--------|
| `backend/src/db/schema.sql` | Campo `commission_pct` y `commission_fixed` en `professionals` |
| `backend/src/controllers/professionals.controller.js` | Soporte para actualizar comisiones |
| `backend/src/controllers/analytics.controller.js` | Agregar cálculo de comisiones |
| `frontend/src/pages/Professionals.jsx` | Campo de comisión en el form |
| `frontend/src/pages/Analytics.jsx` | Sección de comisiones por profesional |

---

- [ ] **Paso 1: Migrar tabla professionals**

```sql
-- Agregar columnas (en Railway console o migrate.js):
ALTER TABLE professionals
  ADD COLUMN IF NOT EXISTS commission_pct NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_fixed NUMERIC DEFAULT 0;
-- commission_pct: porcentaje (0-100), ej: 30 = 30%
-- commission_fixed: monto fijo por consulta en CLP
```

- [ ] **Paso 2: Actualizar analytics.controller.js**

```js
// En analytics.controller.js, agregar endpoint GET /analytics/commissions:
const getCommissions = async (req, res) => {
  const { from, to } = req.query;
  const fromDate = from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const toDate = to || new Date().toISOString().slice(0, 10);

  try {
    const { rows } = await db.query(`
      SELECT
        pr.id,
        pr.name as professional_name,
        pr.commission_pct,
        pr.commission_fixed,
        COUNT(c.id) as total_consultations,
        COALESCE(SUM(s.price), 0) as total_revenue,
        COALESCE(
          SUM(
            CASE
              WHEN pr.commission_pct > 0 THEN (s.price * pr.commission_pct / 100)
              WHEN pr.commission_fixed > 0 THEN pr.commission_fixed
              ELSE 0
            END
          ), 0
        ) as total_commission
      FROM professionals pr
      LEFT JOIN consultations c ON c.professional_id = pr.id
        AND LEFT(c.created_at::text, 10) >= $2
        AND LEFT(c.created_at::text, 10) <= $3
      LEFT JOIN bookings b ON c.booking_id = b.id
      LEFT JOIN services s ON b.service_id = s.id
      WHERE pr.business_id = $1 AND pr.active = 1
      GROUP BY pr.id, pr.name, pr.commission_pct, pr.commission_fixed
      ORDER BY total_commission DESC
    `, [req.business.id, fromDate, toDate]);

    res.json(rows);
  } catch (err) {
    console.error('[analytics] getCommissions error:', err.message);
    res.status(500).json({ error: 'Error interno' });
  }
};
```

- [ ] **Paso 3: UI en Professionals.jsx — campo de comisión**

```jsx
// En el form de crear/editar profesional, agregar:
<div className="grid grid-cols-2 gap-3">
  <div>
    <label className="text-xs text-zinc-400 mb-1 block">Comisión %</label>
    <input
      type="number"
      name="commission_pct"
      value={form.commission_pct || 0}
      onChange={handle}
      min="0" max="100"
      placeholder="ej: 30"
      className={inputClass}
    />
    <p className="text-xs text-zinc-500 mt-0.5">% del precio del servicio</p>
  </div>
  <div>
    <label className="text-xs text-zinc-400 mb-1 block">Comisión fija (CLP)</label>
    <input
      type="number"
      name="commission_fixed"
      value={form.commission_fixed || 0}
      onChange={handle}
      min="0"
      placeholder="ej: 5000"
      className={inputClass}
    />
    <p className="text-xs text-zinc-500 mt-0.5">Monto fijo por consulta</p>
  </div>
</div>
```

- [ ] **Paso 4: Tabla de comisiones en Analytics.jsx**

```jsx
// Nueva sección en Analytics (solo para plan Business):
<div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
  <h2 className="text-white font-semibold mb-4">Comisiones por Profesional</h2>
  <table className="w-full text-sm">
    <thead>
      <tr className="border-b border-zinc-800">
        <th className="text-left text-zinc-400 pb-2 font-medium">Profesional</th>
        <th className="text-right text-zinc-400 pb-2 font-medium">Consultas</th>
        <th className="text-right text-zinc-400 pb-2 font-medium">Ingresos</th>
        <th className="text-right text-zinc-400 pb-2 font-medium">Comisión</th>
      </tr>
    </thead>
    <tbody>
      {commissions.map(c => (
        <tr key={c.id} className="border-b border-zinc-800/50">
          <td className="py-3 text-white">{c.professional_name}</td>
          <td className="py-3 text-right text-zinc-300">{c.total_consultations}</td>
          <td className="py-3 text-right text-zinc-300">${Number(c.total_revenue).toLocaleString('es-CL')}</td>
          <td className="py-3 text-right text-emerald-400 font-medium">${Number(c.total_commission).toLocaleString('es-CL')}</td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

- [ ] **Paso 5: Commit**

```bash
git add backend/src/controllers/analytics.controller.js \
        backend/src/controllers/professionals.controller.js \
        backend/src/db/schema.sql \
        frontend/src/pages/Professionals.jsx \
        frontend/src/pages/Analytics.jsx
git commit -m "feat: staff commission tracking and reporting per professional"
```

---

## ══════════════════ FEATURE 8: Google Calendar Sync ══════════════════

### Qué hace
Las reservas se sincronizan automáticamente al Google Calendar del dueño del negocio. Cuando se crea una reserva, se crea un evento en el calendario. Cuando se cancela, se borra el evento.

### Por qué importa
- **Retención máxima:** Es el feature más pedido por médicos y terapeutas que viven en Google Calendar
- **Diferenciador:** Pocos competidores en Chile tienen esta integración
- **Tiempo:** 3–4 días (OAuth2 flow es complejo)

### Dependencias
```bash
cd backend && npm install googleapis
```

### Archivos

| Archivo | Acción |
|---------|--------|
| `backend/src/services/googleCalendar.js` | NUEVO: OAuth2 + CRUD de eventos |
| `backend/src/controllers/integrations.controller.js` | NUEVO: OAuth flow, connect/disconnect |
| `backend/src/routes/integrations.routes.js` | NUEVO |
| `backend/src/db/schema.sql` | Nueva tabla `integrations` |
| `backend/src/controllers/bookings.controller.js` | Hook al crear/cancelar reservas |
| `frontend/src/pages/Settings.jsx` | Botón "Conectar Google Calendar" |

---

- [ ] **Paso 1: Crear tabla integrations**

```sql
CREATE TABLE IF NOT EXISTS integrations (
  id          BIGSERIAL PRIMARY KEY,
  business_id BIGINT    NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  type        TEXT      NOT NULL, -- 'google_calendar'
  access_token  TEXT,
  refresh_token TEXT,
  token_expiry  TIMESTAMPTZ,
  calendar_id   TEXT,
  active      BOOLEAN   NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(business_id, type)
);
```

- [ ] **Paso 2: Configurar Google Cloud Console**

```
1. Ir a https://console.cloud.google.com
2. Crear proyecto o usar uno existente
3. APIs & Services → Enable → buscar "Google Calendar API" → Habilitar
4. Credentials → Create Credentials → OAuth 2.0 Client ID
5. Application type: Web application
6. Authorized redirect URIs: https://saas-agendamiento-production.up.railway.app/api/integrations/google/callback
7. Descargar client_id y client_secret
8. Agregar a Railway env vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
```

- [ ] **Paso 3: Crear googleCalendar.js**

```js
// backend/src/services/googleCalendar.js
const { google } = require('googleapis');
const db = require('../db/database');

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.BACKEND_URL}/api/integrations/google/callback`
  );
}

function getAuthUrl(state) {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
    state,
    prompt: 'consent',
  });
}

async function getTokens(code) {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);
  return tokens;
}

async function createCalendarEvent(businessId, { summary, description, startISO, endISO, location }) {
  const { rows } = await db.query(
    'SELECT access_token, refresh_token, calendar_id FROM integrations WHERE business_id = $1 AND type = $2 AND active = true',
    [businessId, 'google_calendar']
  );
  if (!rows[0]) return null;

  const auth = getOAuth2Client();
  auth.setCredentials({ access_token: rows[0].access_token, refresh_token: rows[0].refresh_token });

  const calendar = google.calendar({ version: 'v3', auth });
  const calendarId = rows[0].calendar_id || 'primary';

  const event = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary,
      description,
      start: { dateTime: startISO, timeZone: 'America/Santiago' },
      end: { dateTime: endISO, timeZone: 'America/Santiago' },
      location,
    },
  });

  return event.data.id;
}

async function deleteCalendarEvent(businessId, eventId) {
  if (!eventId) return;
  const { rows } = await db.query(
    'SELECT access_token, refresh_token, calendar_id FROM integrations WHERE business_id = $1 AND type = $2 AND active = true',
    [businessId, 'google_calendar']
  );
  if (!rows[0]) return;

  const auth = getOAuth2Client();
  auth.setCredentials({ access_token: rows[0].access_token, refresh_token: rows[0].refresh_token });
  const calendar = google.calendar({ version: 'v3', auth });

  await calendar.events.delete({
    calendarId: rows[0].calendar_id || 'primary',
    eventId,
  }).catch(err => console.warn('[gcal] Error borrando evento:', err.message));
}

module.exports = { getAuthUrl, getTokens, createCalendarEvent, deleteCalendarEvent };
```

- [ ] **Paso 4: Crear integrations.controller.js**

```js
// backend/src/controllers/integrations.controller.js
const { getAuthUrl, getTokens } = require('../services/googleCalendar');
const db = require('../db/database');
const jwt = require('jsonwebtoken');

const connectGoogle = async (req, res) => {
  // state = JWT del business para identificar en el callback
  const state = jwt.sign({ businessId: req.business.id }, process.env.JWT_SECRET, { expiresIn: '10m' });
  const url = getAuthUrl(state);
  res.json({ url });
};

const googleCallback = async (req, res) => {
  const { code, state } = req.query;
  try {
    const { businessId } = jwt.verify(state, process.env.JWT_SECRET);
    const tokens = await getTokens(code);

    await db.query(`
      INSERT INTO integrations (business_id, type, access_token, refresh_token, token_expiry)
      VALUES ($1, 'google_calendar', $2, $3, $4)
      ON CONFLICT (business_id, type) DO UPDATE
      SET access_token = $2, refresh_token = $3, token_expiry = $4, active = true
    `, [businessId, tokens.access_token, tokens.refresh_token, new Date(tokens.expiry_date)]);

    // Redirigir al frontend con éxito
    res.redirect(`${process.env.FRONTEND_URL}/dashboard/configuracion?google=connected`);
  } catch (err) {
    console.error('[integrations] googleCallback error:', err.message);
    res.redirect(`${process.env.FRONTEND_URL}/dashboard/configuracion?google=error`);
  }
};

const disconnectGoogle = async (req, res) => {
  await db.query(
    "UPDATE integrations SET active = false WHERE business_id = $1 AND type = 'google_calendar'",
    [req.business.id]
  );
  res.json({ ok: true });
};

const getStatus = async (req, res) => {
  const { rows } = await db.query(
    "SELECT active, created_at FROM integrations WHERE business_id = $1 AND type = 'google_calendar'",
    [req.business.id]
  );
  res.json({ connected: rows[0]?.active || false });
};

module.exports = { connectGoogle, googleCallback, disconnectGoogle, getStatus };
```

- [ ] **Paso 5: Hook en bookings.controller.js**

```js
// En publicCreate, después de COMMIT:
const { createCalendarEvent } = require('../services/googleCalendar');
// En el bloque no-bloqueante post-commit:
createCalendarEvent(business.id, {
  summary: `${name} — ${serviceRow?.name || 'Cita'}`,
  description: `Reserva de ${name}${phone ? '\nTel: ' + phone : ''}`,
  startISO: datetime_iso,
  endISO: new Date(new Date(datetime_iso).getTime() + (serviceRow?.duration_min || 60) * 60000).toISOString(),
}).catch(err => console.warn('[gcal] Error creando evento:', err.message));

// En updateStatus, si el nuevo status es 'cancelled':
// Requiere guardar el gcal_event_id en la tabla bookings (agregar columna)
// ALTER TABLE bookings ADD COLUMN IF NOT EXISTS gcal_event_id TEXT;
```

- [ ] **Paso 6: Commit**

```bash
git add backend/src/services/googleCalendar.js \
        backend/src/controllers/integrations.controller.js \
        backend/src/routes/integrations.routes.js \
        backend/src/controllers/bookings.controller.js \
        backend/src/db/schema.sql \
        backend/package.json \
        frontend/src/pages/Settings.jsx
git commit -m "feat: Google Calendar integration — auto-sync bookings as calendar events"
```

---

## ══════════════════ FEATURE 9: Multi-Sucursal ══════════════════

### Qué hace
Un negocio (ej: Clínica Las Nieves con 3 sedes) puede manejar todas sus sucursales desde una sola cuenta. Cada sucursal tiene su propio calendario, horarios y profesionales, pero el dueño ve el dashboard consolidado.

### Por qué importa
- **Enterprise tier:** Justifica un plan más caro ($XX.XXX CLP/mes)
- **Escalabilidad:** Los negocios que crecen no tienen que crear cuentas separadas
- **Tiempo:** 5–7 días (cambio arquitectural más profundo)

### Schema changes
```sql
-- Nueva tabla para sucursales
CREATE TABLE IF NOT EXISTS locations (
  id          BIGSERIAL PRIMARY KEY,
  business_id BIGINT    NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name        TEXT      NOT NULL,  -- ej: "Sede Providencia"
  address     TEXT,
  phone       TEXT,
  slug_suffix TEXT,                -- ej: "providencia" → /book/miempresa-providencia
  active      BOOLEAN   NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Agregar location_id a las tablas que lo necesitan
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS location_id BIGINT REFERENCES locations(id);
ALTER TABLE schedules     ADD COLUMN IF NOT EXISTS location_id BIGINT REFERENCES locations(id);
ALTER TABLE bookings      ADD COLUMN IF NOT EXISTS location_id BIGINT REFERENCES locations(id);
```

### Archivos
```
backend/src/controllers/locations.controller.js  -- NUEVO CRUD
backend/src/routes/locations.routes.js           -- NUEVO
frontend/src/pages/Locations.jsx                 -- NUEVO: gestión de sucursales
frontend/src/components/Layout.jsx               -- Selector de sucursal activa
frontend/src/pages/Bookings.jsx                  -- Filtro por sucursal
frontend/src/pages/Schedules.jsx                 -- Horarios por sucursal
```

> ⚠️ **Nota:** Este feature requiere cambios en múltiples controllers y pages. Ejecutar en último lugar. Requiere testing exhaustivo para no romper los negocios de una sola sucursal.

---

## ══════════════════ FEATURE 10: API Pública con API Keys ══════════════════

### Qué hace
Negocios con plan Business pueden generar API keys para integrar el sistema de agendamiento con sus propias apps, CRMs o herramientas externas. La API expone: listar disponibilidad, crear reservas, listar reservas, actualizar estado.

### Por qué importa
- **Stickiness:** Los negocios que integran la API no se van
- **B2B2C:** Permite que agencias y desarrolladores construyan sobre la plataforma
- **Tiempo:** 3 días

### Archivos

| Archivo | Acción |
|---------|--------|
| `backend/src/db/schema.sql` | Nueva tabla `api_keys` |
| `backend/src/middleware/apiKeyAuth.js` | NUEVO: middleware que valida X-API-Key header |
| `backend/src/controllers/apiKeys.controller.js` | NUEVO: CRUD de API keys |
| `backend/src/routes/v1.routes.js` | NUEVO: rutas /api/v1/* con autenticación por API key |
| `frontend/src/pages/Settings.jsx` | Sección "API Keys" para crear/revocar keys |

---

- [ ] **Paso 1: Tabla api_keys**

```sql
CREATE TABLE IF NOT EXISTS api_keys (
  id          BIGSERIAL PRIMARY KEY,
  business_id BIGINT    NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name        TEXT      NOT NULL,            -- descripción, ej: "App móvil"
  key_hash    TEXT      NOT NULL UNIQUE,     -- SHA-256 del key real (nunca guardar el key en plano)
  key_prefix  TEXT      NOT NULL,            -- primeros 8 chars para identificar visualmente
  last_used   TIMESTAMPTZ,
  active      BOOLEAN   NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- [ ] **Paso 2: Middleware apiKeyAuth.js**

```js
// backend/src/middleware/apiKeyAuth.js
const crypto = require('node:crypto');
const db = require('../db/database');

module.exports = async function apiKeyAuth(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!key) return res.status(401).json({ error: 'API key requerida (header X-API-Key)' });

  const keyHash = crypto.createHash('sha256').update(key).digest('hex');

  const { rows } = await db.query(
    'SELECT ak.*, b.* FROM api_keys ak JOIN businesses b ON b.id = ak.business_id WHERE ak.key_hash = $1 AND ak.active = true',
    [keyHash]
  );

  if (!rows[0]) return res.status(401).json({ error: 'API key inválida o revocada' });

  // Actualizar last_used de forma no bloqueante
  db.query('UPDATE api_keys SET last_used = NOW() WHERE id = $1', [rows[0].id]).catch(() => {});

  req.business = rows[0];
  next();
};
```

- [ ] **Paso 3: Rutas v1 (mismas que el API interno pero con auth por API key)**

```js
// backend/src/routes/v1.routes.js
const { Router } = require('express');
const apiKeyAuth = require('../middleware/apiKeyAuth');
const { list: listBookings, publicCreate: createBooking } = require('../controllers/bookings.controller');
const router = Router();

// Documentación básica
router.get('/', (req, res) => res.json({
  version: 'v1',
  endpoints: [
    'GET  /api/v1/bookings?date=YYYY-MM-DD',
    'POST /api/v1/bookings',
    'GET  /api/v1/slots?days=7',
  ]
}));

router.get('/bookings', apiKeyAuth, listBookings);
router.post('/bookings', apiKeyAuth, (req, res, next) => {
  req.params.slug = req.business.slug;
  createBooking(req, res, next);
});

module.exports = router;
```

- [ ] **Paso 4: UI en Settings.jsx para gestionar keys**

```jsx
// Sección API Keys en configuración:
<div className="space-y-4">
  <div className="flex items-center justify-between">
    <h3 className="text-white font-medium">API Keys</h3>
    <button onClick={createApiKey} className={btnSmallClass}>+ Nueva key</button>
  </div>
  <p className="text-zinc-400 text-sm">
    Las API keys te permiten integrar tu sistema de agendamiento con otras herramientas.
  </p>
  {apiKeys.map(k => (
    <div key={k.id} className="flex items-center justify-between bg-zinc-800 rounded-xl px-4 py-3">
      <div>
        <p className="text-white text-sm font-medium">{k.name}</p>
        <p className="text-zinc-500 text-xs font-mono">{k.key_prefix}••••••••</p>
        {k.last_used && <p className="text-zinc-600 text-xs">Último uso: {new Date(k.last_used).toLocaleDateString('es-CL')}</p>}
      </div>
      <button onClick={() => revokeApiKey(k.id)} className="text-red-400 hover:text-red-300 text-xs">Revocar</button>
    </div>
  ))}
</div>
```

- [ ] **Paso 5: Commit**

```bash
git add backend/src/db/schema.sql \
        backend/src/middleware/apiKeyAuth.js \
        backend/src/controllers/apiKeys.controller.js \
        backend/src/routes/v1.routes.js \
        frontend/src/pages/Settings.jsx
git commit -m "feat: public API with API key authentication for external integrations"
```

---

## Resumen de esfuerzos y prioridades

| Feature | Esfuerzo | Impacto | Prioridad |
|---------|----------|---------|-----------|
| Templates de mensajes | 1 día | Alto (retención) | 🔥 Hacer primero |
| PDF historial | 1 día | Alto (ventas) | 🔥 Hacer primero |
| Cancelación paciente | 4 horas | Alto (operacional) | 🔥 Hacer primero |
| Bot cancelar/reprogramar | 2 días | Alto (UX bot) | ⚡ Pronto |
| Mercado Pago | 3 días | Muy alto (monetización) | ⚡ Pronto |
| SMS fallback | 1 día | Medio (cobertura) | 📌 Cuando se necesite |
| Comisiones | 1 día | Alto (plan Business) | 📌 Cuando se necesite |
| Google Calendar | 3 días | Muy alto (retención) | 📌 Cuando se necesite |
| Multi-sucursal | 7 días | Alto (enterprise) | 🔮 Futuro |
| API pública | 3 días | Alto (stickiness) | 🔮 Futuro |

**Total estimado:** 5–7 semanas de trabajo (si se hace todo).
**MVP de alto impacto (primeras 3 prioridades):** 2.5 días.
