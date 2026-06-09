-- Neon PostgreSQL schema

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

CREATE TABLE IF NOT EXISTS professionals (
  id               BIGSERIAL PRIMARY KEY,
  business_id      BIGINT    NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name             TEXT      NOT NULL,
  specialty        TEXT      NOT NULL,
  email            TEXT,
  active           SMALLINT  NOT NULL DEFAULT 1,
  commission_pct   NUMERIC   NOT NULL DEFAULT 0,
  commission_fixed NUMERIC   NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

CREATE TABLE IF NOT EXISTS message_templates (
  id          BIGSERIAL PRIMARY KEY,
  business_id BIGINT    NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  type        TEXT      NOT NULL, -- 'booking_confirmation' | 'reminder' | 'cancellation'
  channel     TEXT      NOT NULL, -- 'whatsapp' | 'email_subject' | 'email_body'
  content     TEXT      NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(business_id, type, channel)
);

-- Migrations: add columns to existing tables (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='professionals' AND column_name='commission_pct') THEN
    ALTER TABLE professionals ADD COLUMN commission_pct NUMERIC NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='professionals' AND column_name='commission_fixed') THEN
    ALTER TABLE professionals ADD COLUMN commission_fixed NUMERIC NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bookings_business_datetime ON bookings(business_id, datetime_iso);
CREATE INDEX IF NOT EXISTS idx_bookings_cancel_token ON bookings(cancel_token);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(business_id, status);
CREATE INDEX IF NOT EXISTS idx_consultations_patient ON consultations(business_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_patients_business ON patients(business_id);
CREATE INDEX IF NOT EXISTS idx_services_business_active ON services(business_id, active);
CREATE INDEX IF NOT EXISTS idx_professionals_business ON professionals(business_id, active);
CREATE INDEX IF NOT EXISTS idx_audit_logs_business ON audit_logs(business_id, created_at);

-- ── Mercado Pago payments ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id               BIGSERIAL PRIMARY KEY,
  business_id      BIGINT    NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  booking_id       BIGINT    REFERENCES bookings(id),
  mp_preference_id TEXT,
  mp_payment_id    TEXT,
  amount           NUMERIC   NOT NULL,
  currency         TEXT      NOT NULL DEFAULT 'CLP',
  status           TEXT      NOT NULL DEFAULT 'pending', -- pending | approved | rejected | cancelled
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_business ON payments(business_id, created_at);

-- ── Integrations (Google Calendar, etc.) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS integrations (
  id          BIGSERIAL PRIMARY KEY,
  business_id BIGINT    NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  type        TEXT      NOT NULL,  -- 'google_calendar'
  access_token   TEXT,
  refresh_token  TEXT,
  token_expiry   TIMESTAMPTZ,
  calendar_id    TEXT,              -- primary or specific calendar ID
  active         BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(business_id, type)
);

-- Track the Google Calendar event ID created for each booking (for later deletion)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS gcal_event_id TEXT;

-- ── API Keys ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
  id          BIGSERIAL PRIMARY KEY,
  business_id BIGINT    NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name        TEXT      NOT NULL,
  key_hash    TEXT      NOT NULL UNIQUE,
  key_prefix  VARCHAR(8) NOT NULL,
  last_used   TIMESTAMPTZ,
  active      BOOLEAN   NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
