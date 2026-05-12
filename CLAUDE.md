# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Start

**Setup:**
```bash
# Install root, backend, and frontend dependencies
npm install
cd backend && npm install && cd ../frontend && npm install && cd ..

# Create .env file in backend/ with required vars (see PENDIENTE_CONFIGURAR.md)
```

**Development:**
```bash
# Terminal 1: Backend
npm run backend  # Runs on http://localhost:3001

# Terminal 2: Frontend
npm run frontend # Runs on http://localhost:5173
```

**Common Commands:**

| Command | Purpose |
|---------|---------|
| `npm test` (in backend/) | Run Jest tests (32 tests for crypto & RUT validation) |
| `npm run test:watch` (in backend/) | Watch mode for tests |
| `npm run build` (in frontend/) | Build production bundle (with code splitting) |
| `npm run lint` (in frontend/) | Run ESLint |
| `node src/index.js` (in backend/) | Run server (requires ENCRYPTION_KEY in .env) |

---

## Architecture Overview

This is a **multi-tenant SaaS scheduling platform** for healthcare (doctors, clinics, patients). The codebase separates concerns into **backend API** (Node.js/Express/SQLite) and **frontend dashboard** (React/Vite/Tailwind).

### Backend Architecture

**Entry point:** `backend/src/index.js`
- Loads `.env` (fails if `ENCRYPTION_KEY` missing or <32 chars)
- Initializes SQLite database with schema
- Starts reminder job (runs every 30 min)
- Registers Express middleware: helmet (security headers), CORS, rate limiting, JSON parsing
- Registers 12 API route groups: auth, services, schedules, bookings, patients, consultations, prescriptions, professionals, billing, analytics, settings, public

**Core folders:**
- `controllers/` — Business logic for each feature (e.g., bookings.controller handles create/read/update reservations)
- `routes/` — Express route definitions; each route file imports its controller
- `middleware/` — `auth.js` validates JWT tokens; other middleware in index.js (rate limiting, CORS)
- `services/` — External integrations (Twilio for WhatsApp reminders)
- `db/` — `database.js` initializes SQLite with schema (businesses, services, schedules, bookings, patients, consultations, prescriptions, professionals). Uses `PRAGMA foreign_keys = ON` and WAL mode
- `lib/` — Utilities: `crypto.js` (AES-256 encrypt/decrypt for clinical data), `rut.js` (validate Chilean RUTs)
- `jobs/` — `reminders.js`: cron job that runs every 30 min, sends WhatsApp reminders via Twilio to patients with upcoming bookings
- `__tests__/` — Jest tests for `crypto.js` and `rut.js` (32 tests total)

**Key routes & controllers:**

| Route | Auth | Purpose |
|-------|------|---------|
| `POST /api/auth/register` | No | Register business (email, password, phone) |
| `POST /api/auth/login` | No | Login → return JWT token |
| `GET /api/auth/me` | JWT | Get logged-in business profile |
| `POST /api/services` | JWT | Create service (name, duration_min, price) |
| `GET /api/bookings` | JWT | List reservations with filters (date, status) |
| `PATCH /api/bookings/:id/status` | JWT | Change booking status (pending → confirmed → completed/cancelled) |
| `POST /api/bookings/public/:slug` | No | Public booking endpoint (client creates reservation) |
| `GET /api/public/:slug` | No | Get business profile (public view) |
| `POST /api/billing/checkout` | JWT | Initiate Stripe checkout |
| `POST /api/billing/webhook` | No (raw body) | Stripe webhook (checkout.session.completed, customer.subscription.deleted) |
| `GET /api/patients` | JWT | List patients with search |
| `GET /api/consultations` | JWT | List consultations (joined with patients) |
| `POST /api/prescriptions` | JWT | Add prescription for consultation |
| `GET /api/professionals` | JWT | List professionals (doctors/staff) |

**Security & Validation:**
- Rate limiting: 200 req/15min global; 10 auth attempts/15min; 5 bookings/min for public endpoint
- JWT verification in `middleware/auth.js`; uses `Bearer <token>` header
- Password hashing: bcryptjs (12 rounds)
- Clinical data encrypted with AES-256 (patient names, notes) using `ENCRYPTION_KEY` env var
- CORS only allows `http://localhost:5173` (dev) or `FRONTEND_URL` (prod)

**Important details:**
- Stripe webhook registered as raw body handler before `express.json()` to preserve signature validation
- Database file location: `./data/saas.db` (or `DB_PATH` env var)
- Reminder job checks bookings where `reminder_sent = 0` and date is within 24 hours, then marks `reminder_sent = 1`

### Frontend Architecture

**Entry point:** `frontend/src/main.jsx` → renders `App.jsx`

**Routing:** React Router v7 with protected routes. Unauthenticated users see Login/Register; authenticated users access `/dashboard/*` and `/dashboard-health/*`.

**Core folders:**
- `pages/` — 15 page components (Login, Register, Dashboard, Services, Bookings, Patients, PatientDetail, Analytics, Consultations, etc.); uses `React.lazy()` for code splitting
- `components/` — `Layout.jsx` (navbar, sidebar); most UI logic in pages
- `api/` — `axiosInstance.js` (HTTP client with auth header, proxy to `/api`)
- `context/` — Auth context (stores JWT token)
- `utils/` — Helpers (date formatting, validation)
- `config/` — API base URL

**Pages & Routes:**

| Path | Component | Auth Required | Purpose |
|------|-----------|---|---------|
| `/` | Login | No | Login form |
| `/register` | Register | No | Business registration |
| `/forgot-password` | ForgotPassword | No | Email input for reset link |
| `/reset-password/:token` | ResetPassword | No | Set new password |
| `/dashboard` | Dashboard (lazy) | JWT | Main reservation list (filterable by date, status) |
| `/dashboard/servicios` | Services (lazy) | JWT | Manage services (add/edit/delete) |
| `/dashboard/horarios` | Schedules (lazy) | JWT | Configure opening hours by day of week |
| `/dashboard/pacientes` | Patients (lazy) | JWT | List patients with search |
| `/dashboard/paciente/:id` | PatientDetail (lazy) | JWT | View patient history, consultations, prescriptions |
| `/dashboard/profesionales` | Professionals (lazy) | JWT | List staff (doctors) |
| `/dashboard/consultas` | Consultations (lazy) | JWT | View medical consultations |
| `/dashboard/configuracion` | Settings (lazy) | JWT | Profile, plan, billing |
| `/dashboard/analytics` | Analytics (lazy) | JWT | Revenue, bookings trends (Recharts charts) |
| `/book/:slug` | BookingPage | No | Public booking form for business |

**Key libraries:**
- React 19, React Router 7, Axios, Recharts (charts), Tailwind CSS, Vite
- No state management library; uses React Context for auth token

**Build output:** `frontend/dist/` with code splitting (250 KB gzip total; ~80 KB main app, rest split across page chunks)

---

## Development Notes

### Database Schema

SQLite with 11 tables:
- `businesses` — Tenants (email, password_hash, plan: basic/pro/clinica)
- `services` — Business services (duration_min, price)
- `schedules` — Weekly opening hours (dow: 0–6, slots as JSON array)
- `bookings` — Patient reservations (patient_rut, date, status, reminder_sent)
- `patients` — Patient records (rut, name encrypted, phone, specialty)
- `consultations` — Medical visits (date, notes encrypted, professional_id)
- `prescriptions` — Medication orders (consultation_id, description encrypted)
- `professionals` — Doctors/staff (business_id, specialty)
- `billing_customers` — Stripe customer references (business_id, stripe_customer_id, plan, active)
- `password_resets` — Reset token storage (token_hash, expires_at)
- Plus implicit indexes on foreign keys

### Environment Variables

**Required in backend/.env:**
- `ENCRYPTION_KEY` — 32+ char hex string; used for AES-256 encryption (data at rest)
- `DB_PATH` (optional) — SQLite file path; defaults to `./data/saas.db`
- `PORT` (optional) — API port; defaults to 3001
- `NODE_ENV` — `development` (disables rate limiting) or `production`
- `FRONTEND_URL` (prod only) — Allowed CORS origin

**Optional for features:**
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` — WhatsApp reminders
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_CLINICA` — Billing
- `SMTP_*` (not yet used) — Email for password resets

See `backend/.env.example` and `PENDIENTE_CONFIGURAR.md` for details.

### Testing

- Run `npm test` in backend to execute Jest suite (32 tests)
- Tests cover `lib/crypto.js` (encrypt/decrypt AES-256) and `lib/rut.js` (Chilean RUT validation)
- Test files: `backend/src/__tests__/crypto.test.js`, `backend/src/__tests__/rut.test.js`

### Code Splitting & Performance

Frontend uses `React.lazy()` on 8 pages (Services, Bookings, Patients, PatientDetail, Professionals, Consultations, Settings, Analytics). Main bundle is ~80 KB gzip; each page chunk is 1–10 KB gzip. Reduces initial load time.

### Error Handling

- Backend: Global error handler in `index.js` catches all errors and returns generic `{ error: 'Error interno del servidor' }` (never exposes internals to client)
- Frontend: Axios interceptor should check for 401 (token expired) and redirect to login

---

## Branching & Commits

- Main development branch: `claude/review-and-generate-docs-RVXkT` (or as specified in session)
- All changes are committed with clear messages (e.g., "feat: add consultations page", "fix: double-booking prevention")
- Tests must pass (`npm test` in backend) before pushing

---

## Selling Points (Product)

This is a **white-label SaaS for healthcare scheduling**:
- Multi-tenant (each clinic/doctor is a separate business)
- Real-time bookings with double-booking prevention
- Patient history & consultations (HIPAA-compliant encryption)
- WhatsApp reminders (Twilio)
- Recurring billing (Stripe) with 3 plans (Basic, Pro, Clínica)
- Public booking page per business
- Analytics dashboard (revenue, booking trends)
- Fully localized for Spanish-speaking markets (Chilean RUT validation, CLP pricing)

Target customers: Clinics, private practices, wellness centers in Latin America.
