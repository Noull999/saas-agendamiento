const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || './data/saas.db';
const dbDir = path.dirname(path.resolve(dbPath));

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new DatabaseSync(path.resolve(dbPath));

// Forzar UTF-8 (solo aplica en bases de datos nuevas; en existentes es no-op)
db.exec("PRAGMA encoding = 'UTF-8'");
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS businesses (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    slug          TEXT    UNIQUE NOT NULL,
    name          TEXT    NOT NULL,
    owner_email   TEXT    UNIQUE NOT NULL,
    password_hash TEXT    NOT NULL,
    phone         TEXT,
    plan          TEXT    NOT NULL DEFAULT 'basic',
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS services (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id  INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name         TEXT    NOT NULL,
    description  TEXT,
    duration_min INTEGER NOT NULL DEFAULT 60,
    price        REAL,
    active       INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS schedules (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    dow         INTEGER NOT NULL,
    slots       TEXT    NOT NULL DEFAULT '[]',
    UNIQUE(business_id, dow)
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id  INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    service_id   INTEGER REFERENCES services(id),
    client_name  TEXT    NOT NULL,
    client_email TEXT,
    client_phone TEXT,
    datetime_iso TEXT    NOT NULL,
    status       TEXT    NOT NULL DEFAULT 'confirmed',
    source       TEXT    NOT NULL DEFAULT 'web',
    notes        TEXT,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`);

[
  "ALTER TABLE businesses ADD COLUMN description TEXT DEFAULT ''",
  "ALTER TABLE businesses ADD COLUMN template_id TEXT DEFAULT 'modern_minimal'",
  "ALTER TABLE businesses ADD COLUMN page_config TEXT DEFAULT '{}'"
].forEach(sql => {
  try { db.exec(sql); } catch (_) {}
});

db.exec(`
  CREATE TABLE IF NOT EXISTS page_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    default_config TEXT DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Seed data: 5 templates
const existingTemplates = db.prepare('SELECT COUNT(*) as count FROM page_templates').get();
if (existingTemplates.count === 0) {
  const templates = [
    {
      template_id: 'modern_minimal',
      name: 'Modern Minimal',
      description: 'Diseño limpio y profesional con 2 columnas. Ideal para consultorías y servicios profesionales.'
    },
    {
      template_id: 'full_width',
      name: 'Full Width Flow',
      description: 'Layout fluido de una sola columna. Perfecto para clínicas y servicios médicos.'
    },
    {
      template_id: 'hero_focus',
      name: 'Hero Focus',
      description: 'Imagen hero grande y llamativa. Ideal para salones de belleza y spas.'
    },
    {
      template_id: 'gallery_style',
      name: 'Gallery Style',
      description: 'Galería visual tipo Pinterest. Perfecto para servicios creativos y fotografía.'
    },
    {
      template_id: 'luxury_premium',
      name: 'Luxury Premium',
      description: 'Diseño elegante y sofisticado. Para servicios de lujo y premium.'
    }
  ];

  const stmt = db.prepare(
    'INSERT INTO page_templates (template_id, name, description, default_config) VALUES (?, ?, ?, ?)'
  );
  templates.forEach(t => {
    stmt.run(t.template_id, t.name, t.description, '{}');
  });
}

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

// Create indexes for improved query performance
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_services_business_id ON services(business_id);
  CREATE INDEX IF NOT EXISTS idx_schedules_business_id ON schedules(business_id);
  CREATE INDEX IF NOT EXISTS idx_bookings_business_id ON bookings(business_id);
  CREATE INDEX IF NOT EXISTS idx_bookings_business_date ON bookings(business_id, date(datetime_iso));
  CREATE INDEX IF NOT EXISTS idx_professionals_business_id ON professionals(business_id);
  CREATE INDEX IF NOT EXISTS idx_patients_business_id ON patients(business_id);
  CREATE INDEX IF NOT EXISTS idx_consultations_business_id ON consultations(business_id);
  CREATE INDEX IF NOT EXISTS idx_consultations_patient_id ON consultations(patient_id);
  CREATE INDEX IF NOT EXISTS idx_page_templates_template_id ON page_templates(template_id);
`);

module.exports = db;
