const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || './data/saas.db';
const dbDir = path.dirname(path.resolve(dbPath));

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new DatabaseSync(path.resolve(dbPath));

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
  "ALTER TABLE businesses ADD COLUMN description TEXT DEFAULT ''"
].forEach(sql => {
  try { db.exec(sql); } catch (_) {}
});

module.exports = db;
