# SaaS de Agendamiento

Plataforma multi-tenant de agendamiento para negocios que atienden con hora — clínicas, salones de belleza, consultorías, profesionales independientes. Cada negocio tiene su propio slug público (`/book/:slug`) para que sus clientes reserven online, mientras el dueño gestiona servicios, horarios, profesionales, pacientes y pagos desde un panel de administración.

![Preview](docs/banner.svg)

**Demo en vivo:** [saas-agendamiento-backend.vercel.app](https://saas-agendamiento-backend.vercel.app) — cuenta de prueba (datos ficticios, no es un negocio real):
- Email: `demo@agendasaas.cl`
- Contraseña: `DemoSaaS2026!`

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?logo=postgresql&logoColor=white)
![JWT](https://img.shields.io/badge/Auth-JWT-black?logo=jsonwebtokens)
![Stripe](https://img.shields.io/badge/Pagos-Stripe%20%2B%20MercadoPago-635BFF?logo=stripe&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/TailwindCSS-4-06B6D4?logo=tailwindcss&logoColor=white)

## Arquitectura multi-tenant

Un único backend y una única base de datos sirven a todos los negocios registrados. Cada tabla (`services`, `schedules`, `professionals`, `patients`, `bookings`, `consultations`...) cuelga de `business_id` con `ON DELETE CASCADE`, y cada negocio se identifica públicamente por su `slug` (`businesses.slug`, único). El aislamiento entre tenants se resuelve a nivel de query, no de esquema separado — todo el filtrado por negocio pasa por el JWT del dueño autenticado o por el slug en las rutas públicas.

## Features implementadas

- **Multi-tenant real**: registro de negocio con slug propio, página pública de reservas por negocio (`/book/:slug`), aislamiento de datos por `business_id`.
- **Gestión de servicios y horarios**: CRUD de servicios (duración, precio) y configuración de horarios semanales por día.
- **Profesionales y comisiones**: alta de profesionales con especialidad y esquema de comisión (porcentaje o fijo).
- **Reservas**: creación pública sin login, listado y filtrado por fecha/estado, cambio de estado desde el panel, cancelación por token.
- **Ficha clínica**: pacientes (con RUT), consultas asociadas a una reserva, diagnóstico/tratamiento y generación de recetas en PDF (`pdfkit`).
- **Multi-sede**: soporte de múltiples locations por negocio.
- **Pagos**: integración con Stripe y MercadoPago, webhooks de facturación.
- **Notificaciones**: recordatorios automáticos (job programado), envío por email (`nodemailer`), SMS/WhatsApp vía Twilio y bot de WhatsApp.
- **Integración con Google Calendar** para sincronizar reservas.
- **Reportes y analítica** por negocio, con gráficos en el panel (`recharts`).
- **API pública con API Keys** propias, separada de la sesión JWT del dashboard.
- **Autenticación JWT** con roles por negocio, rate limiting y hardening (`helmet`, `express-rate-limit`).
- **Tests**: suite con Jest para lógica crítica (hashing, validación de RUT chileno).

## Stack técnico

**Backend:** Node.js, Express, PostgreSQL (Neon) vía `pg`, JWT, bcryptjs, Jest.
**Frontend:** React 19, React Router 7, Vite, Tailwind CSS 4, Recharts, Axios.
**Integraciones:** Stripe, MercadoPago, Twilio (SMS/WhatsApp), Nodemailer, Google Calendar API, PDFKit.
**Deploy:** todo en Vercel — el backend Express sirve tanto la API (`/api/*`) como el frontend compilado desde el mismo origen (sin CORS entre ambos), enrutado vía `vercel.json`.

## Correr en desarrollo

**Terminal 1 — Backend:**
```bash
cd backend
npm install
npm run dev
# http://localhost:3001
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm install
npm run dev
# http://localhost:5173
```

## Rutas principales (frontend)

| URL | Descripción |
|-----|-------------|
| `/register` | Registro de negocio |
| `/login` | Login |
| `/dashboard` | Panel de reservas |
| `/dashboard/servicios` | Gestión de servicios |
| `/dashboard/horarios` | Configurar horarios |
| `/book/:slug` | Página pública de reserva del cliente |

## API (backend)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/api/auth/register` | No | Registrar negocio |
| POST | `/api/auth/login` | No | Login |
| GET | `/api/auth/me` | JWT | Perfil del negocio |
| GET/POST/PUT/DELETE | `/api/services` | JWT | CRUD de servicios |
| GET/POST | `/api/schedules` | JWT | Horarios (upsert) |
| GET | `/api/bookings` | JWT | Listar reservas (filtros: date, status) |
| PATCH | `/api/bookings/:id/status` | JWT | Cambiar estado de reserva |
| POST | `/api/bookings/public/:slug` | No | Crear reserva (público) |
| GET | `/api/public/:slug` | No | Perfil público del negocio |
| — | `/api/patients`, `/api/professionals`, `/api/consultations`, `/api/prescriptions`, `/api/locations`, `/api/billing`, `/api/payments`, `/api/whatsapp`, `/api/analytics`, `/api/reports`, `/api/apiKeys` | JWT | Módulos adicionales del panel |

---

Desarrollado por [Jose Esteban Asencio](mailto:joseestebanasencio@gmail.com).
