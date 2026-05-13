# SaaS Agendamiento — Core Features Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Agregar email de confirmación + cancelación por el paciente + vista de calendario + portal básico del paciente + arreglar encriptación en demo.

**Architecture:** Backend agrega email.js service (nodemailer), cancel_token en bookings, endpoints públicos de cancelación y portal. Frontend agrega CancelBookingPage, MyBookingsPage, toggle lista/calendario en Bookings.jsx.

**Tech Stack:** Node.js/Express/SQLite, React/Vite/Tailwind, nodemailer (ya instalado), crypto.randomUUID()

---

### Task 1: Fix Demo — Encrypt clinical data in seed-demo.js

**Files:**
- Modify: `backend/seed-demo.js`

- [ ] Fix `insertConsultas` to call `encrypt()` on notes, diagnosis, treatment, and prescription content

### Task 2: Add cancel_token column to bookings schema

**Files:**
- Modify: `backend/src/db/database.js` (ALTER TABLE block at bottom)

- [ ] Add `"ALTER TABLE bookings ADD COLUMN cancel_token TEXT"` to the forEach block

### Task 3: Create email notification service

**Files:**
- Create: `backend/src/services/email.js`

- [ ] Implement `sendBookingConfirmation({ clientName, clientEmail, serviceName, datetimeISO, businessName, cancelToken, frontendUrl })` using nodemailer, graceful skip if SMTP not configured

### Task 4: Update publicCreate — generate cancel_token + send email

**Files:**
- Modify: `backend/src/controllers/bookings.controller.js`

- [ ] Import `randomUUID` from `node:crypto` and `sendBookingConfirmation` from `../services/email`
- [ ] Generate `cancelToken = randomUUID()` and store in DB within the transaction
- [ ] Call email service after booking creation (fire-and-forget with `.catch()`)
- [ ] Include `cancel_token` in the JSON response

### Task 5: Public cancel endpoints (GET info + POST confirm)

**Files:**
- Modify: `backend/src/routes/public.routes.js`

- [ ] Add `GET /cancel/:token` — returns booking info (for preview page)
- [ ] Add `POST /cancel/:token` — cancels booking if future + not already cancelled

### Task 6: Patient portal endpoint

**Files:**
- Modify: `backend/src/routes/public.routes.js`

- [ ] Add `GET /:slug/mis-citas?phone=...` — returns upcoming bookings for a phone number at that business (no sensitive data)

### Task 7: Frontend — CancelBookingPage

**Files:**
- Create: `frontend/src/pages/CancelBookingPage.jsx`

- [ ] Fetch booking info on load via GET `/api/public/cancel/:token`
- [ ] Show booking details (nombre, fecha, servicio, negocio)
- [ ] "Cancelar mi reserva" button → POST `/api/public/cancel/:token`
- [ ] Show success / error states

### Task 8: Frontend — MyBookingsPage (patient portal)

**Files:**
- Create: `frontend/src/pages/MyBookingsPage.jsx`

- [ ] Public page at `/book/:slug/mis-citas`
- [ ] Form: patient enters their phone number
- [ ] On submit: GET `/api/public/:slug/mis-citas?phone=...`
- [ ] Show upcoming bookings with cancel button per booking

### Task 9: Bookings.jsx — Add weekly calendar toggle

**Files:**
- Modify: `frontend/src/pages/Bookings.jsx`

- [ ] Add "Lista / Semana" toggle buttons in header
- [ ] Calendar view: 7-column week grid (Mon-Sun), bookings as colored cards in each day column
- [ ] Week navigation (prev/next)
- [ ] Default: list view (existing), calendar view as option

### Task 10: BookingPage — Show cancel + portal links on step 5

**Files:**
- Modify: `frontend/src/pages/BookingPage.jsx`

- [ ] Store `cancel_token` from API response in state
- [ ] On step 5 confirmation: show "Ver mis citas" link to `/book/:slug/mis-citas`
- [ ] If cancel_token available: show "Cancelar esta reserva" link to `/cancel/:token`

### Task 11: Register new routes in App.jsx

**Files:**
- Modify: `frontend/src/App.jsx`

- [ ] Add lazy imports for `CancelBookingPage` and `MyBookingsPage`
- [ ] Add routes: `/cancel/:token` and `/book/:slug/mis-citas`
