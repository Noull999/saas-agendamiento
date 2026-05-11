const { DatabaseSync } = require('node:sqlite');
const path = require('path');

let testDb = null;

const initTestDb = () => {
  testDb = new DatabaseSync(':memory:');

  testDb.exec('PRAGMA foreign_keys = ON');
  testDb.exec('PRAGMA encoding = \'UTF-8\'');

  // Create tables for testing
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS businesses (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      slug          TEXT    UNIQUE NOT NULL,
      name          TEXT    NOT NULL,
      owner_email   TEXT    UNIQUE NOT NULL,
      password_hash TEXT    NOT NULL,
      phone         TEXT,
      plan          TEXT    NOT NULL DEFAULT 'basic',
      created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      description   TEXT DEFAULT '',
      template_id   TEXT DEFAULT 'modern_minimal',
      page_config   TEXT DEFAULT '{}',
      specialty     TEXT DEFAULT 'general'
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
      created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
      patient_id   INTEGER,
      professional_id INTEGER,
      reminded     INTEGER DEFAULT 0,
      client_rut   TEXT
    );

    CREATE TABLE IF NOT EXISTS page_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      default_config TEXT DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

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

  // Seed templates
  const existingTemplates = testDb.prepare('SELECT COUNT(*) as count FROM page_templates').get();
  if (existingTemplates.count === 0) {
    const templates = [
      {
        template_id: 'modern_minimal',
        name: 'Modern Minimal',
        description: 'Diseño limpio y profesional'
      },
      {
        template_id: 'full_width',
        name: 'Full Width Flow',
        description: 'Layout fluido de una sola columna'
      },
      {
        template_id: 'hero_focus',
        name: 'Hero Focus',
        description: 'Imagen hero grande y llamativa'
      },
      {
        template_id: 'gallery_style',
        name: 'Gallery Style',
        description: 'Galería visual tipo Pinterest'
      },
      {
        template_id: 'luxury_premium',
        name: 'Luxury Premium',
        description: 'Diseño elegante y sofisticado'
      }
    ];

    const stmt = testDb.prepare(
      'INSERT INTO page_templates (template_id, name, description, default_config) VALUES (?, ?, ?, ?)'
    );
    templates.forEach(t => {
      stmt.run(t.template_id, t.name, t.description, '{}');
    });
  }

  return testDb;
};

const getTestDb = () => testDb;

const closeTestDb = () => {
  if (testDb) {
    testDb.close();
    testDb = null;
  }
};

module.exports = {
  initTestDb,
  getTestDb,
  closeTestDb
};
