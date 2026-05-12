require('dotenv').config();
const { DatabaseSync } = require('node:sqlite');
const bcryptjs = require('bcryptjs');
const path = require('path');

// Usar DB de demostración
const dbPath = './data/demo.db';
const db = new DatabaseSync(path.resolve(dbPath));

db.exec("PRAGMA encoding = 'UTF-8'");
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// Crear tablas
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
    service_id   INTEGER NOT NULL REFERENCES services(id),
    patient_name TEXT    NOT NULL,
    patient_rut  TEXT    NOT NULL,
    patient_phone TEXT,
    date         TEXT    NOT NULL,
    status       TEXT    NOT NULL DEFAULT 'pending',
    reminder_sent INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS patients (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id  INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    rut          TEXT    UNIQUE NOT NULL,
    name_encrypted TEXT  NOT NULL,
    phone        TEXT,
    email        TEXT,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS consultations (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id    INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    patient_id     INTEGER NOT NULL REFERENCES patients(id),
    date           TEXT    NOT NULL,
    notes_encrypted TEXT,
    professional_id INTEGER,
    created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS prescriptions (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    consultation_id INTEGER NOT NULL REFERENCES consultations(id),
    description_encrypted TEXT NOT NULL,
    created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS professionals (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id   INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name          TEXT    NOT NULL,
    specialty     TEXT,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS billing_customers (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id         INTEGER UNIQUE NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    stripe_customer_id  TEXT,
    plan                TEXT,
    active              INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS password_resets (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL REFERENCES businesses(id),
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Hash para contraseña demo: "demo123"
const demoPasswordHash = bcryptjs.hashSync('demo123', 12);

// NEGOCIO 1: Clínica Dental "SmileCare"
console.log('🚀 Creando demo: Clínica Dental SmileCare...');
const b1 = db.prepare('INSERT INTO businesses (slug, name, owner_email, password_hash, phone, plan) VALUES (?, ?, ?, ?, ?, ?)').run('smileware-dental', 'SmileCare Dental', 'dr.garcia@smileware.com', demoPasswordHash, '+56987654321', 'pro');
const business1Id = b1.lastInsertRowid;

// Profesionales en SmileCare
db.prepare('INSERT INTO professionals (business_id, name, specialty) VALUES (?, ?, ?)').run(business1Id, 'Dr. Carlos García', 'Odontología General');
db.prepare('INSERT INTO professionals (business_id, name, specialty) VALUES (?, ?, ?)').run(business1Id, 'Dra. Patricia López', 'Ortodoncia');

// Servicios en SmileCare
const s1 = db.prepare('INSERT INTO services (business_id, name, description, duration_min, price) VALUES (?, ?, ?, ?, ?)').run(business1Id, 'Limpieza Dental', 'Higiene y profilaxis', 45, 85000);
const s2 = db.prepare('INSERT INTO services (business_id, name, description, duration_min, price) VALUES (?, ?, ?, ?, ?)').run(business1Id, 'Obturación', 'Reparación de caries', 60, 120000);
const s3 = db.prepare('INSERT INTO services (business_id, name, description, duration_min, price) VALUES (?, ?, ?, ?, ?)').run(business1Id, 'Implante Dental', 'Implante con corona', 120, 850000);

// Horarios SmileCare (Lunes-Viernes 8:00-17:00, Sábado 9:00-14:00)
const horarios = JSON.stringify([
  { start: '08:00', end: '17:00' }
]);
for (let dow = 0; dow < 5; dow++) {
  db.prepare('INSERT INTO schedules (business_id, dow, slots) VALUES (?, ?, ?)').run(business1Id, dow, horarios);
}
// Sábado
db.prepare('INSERT INTO schedules (business_id, dow, slots) VALUES (?, ?, ?)').run(business1Id, 5, JSON.stringify([{ start: '09:00', end: '14:00' }]));

// Citas reservadas en SmileCare
db.prepare(`INSERT INTO bookings (business_id, service_id, patient_name, patient_rut, patient_phone, date, status, reminder_sent)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
  business1Id, s1.lastInsertRowid, 'Juan Pérez', '12345678-9', '+56912345678', '2026-05-15 09:00:00', 'confirmed', 0
);

db.prepare(`INSERT INTO bookings (business_id, service_id, patient_name, patient_rut, patient_phone, date, status, reminder_sent)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
  business1Id, s2.lastInsertRowid, 'María González', '98765432-1', '+56987654321', '2026-05-16 10:30:00', 'pending', 0
);

db.prepare(`INSERT INTO bookings (business_id, service_id, patient_name, patient_rut, patient_phone, date, status, reminder_sent)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
  business1Id, s1.lastInsertRowid, 'Carlos López', '55555555-5', '+56998765432', '2026-05-17 14:00:00', 'completed', 1
);

// Billing para SmileCare
db.prepare('INSERT INTO billing_customers (business_id, stripe_customer_id, plan, active) VALUES (?, ?, ?, ?)').run(business1Id, 'cus_demo_smileware', 'pro', 1);

console.log('✅ SmileCare Dental creada');

// NEGOCIO 2: Centro de Bienestar "ZenStudio"
console.log('🚀 Creando demo: Centro de Bienestar ZenStudio...');
const b2 = db.prepare('INSERT INTO businesses (slug, name, owner_email, password_hash, phone, plan) VALUES (?, ?, ?, ?, ?, ?)').run('zenstudio-yoga', 'ZenStudio Wellness', 'info@zenstudio.com', demoPasswordHash, '+56912345000', 'pro');
const business2Id = b2.lastInsertRowid;

// Profesionales en ZenStudio
db.prepare('INSERT INTO professionals (business_id, name, specialty) VALUES (?, ?, ?)').run(business2Id, 'Natalia Silva', 'Instructora de Yoga');
db.prepare('INSERT INTO professionals (business_id, name, specialty) VALUES (?, ?, ?)').run(business2Id, 'Marco Rodríguez', 'Instructor de Pilates');
db.prepare('INSERT INTO professionals (business_id, name, specialty) VALUES (?, ?, ?)').run(business2Id, 'Laura Muñoz', 'Masajista Terapéutica');

// Servicios en ZenStudio
const z1 = db.prepare('INSERT INTO services (business_id, name, description, duration_min, price) VALUES (?, ?, ?, ?, ?)').run(business2Id, 'Clase de Yoga', 'Yoga Vinyasa 60 min', 60, 15000);
const z2 = db.prepare('INSERT INTO services (business_id, name, description, duration_min, price) VALUES (?, ?, ?, ?, ?)').run(business2Id, 'Pilates Mat', 'Pilates en colchoneta', 45, 12000);
const z3 = db.prepare('INSERT INTO services (business_id, name, description, duration_min, price) VALUES (?, ?, ?, ?, ?)').run(business2Id, 'Masaje Relajante', 'Masaje de cuerpo completo', 90, 50000);

// Horarios ZenStudio (Lunes-Domingo 7:00-20:00)
const horariosDia = JSON.stringify([{ start: '07:00', end: '20:00' }]);
for (let dow = 0; dow < 7; dow++) {
  db.prepare('INSERT INTO schedules (business_id, dow, slots) VALUES (?, ?, ?)').run(business2Id, dow, horariosDia);
}

// Citas en ZenStudio
db.prepare(`INSERT INTO bookings (business_id, service_id, patient_name, patient_rut, patient_phone, date, status, reminder_sent)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
  business2Id, z1.lastInsertRowid, 'Andrea Martínez', '11111111-1', '+56912111111', '2026-05-14 18:00:00', 'confirmed', 0
);

db.prepare(`INSERT INTO bookings (business_id, service_id, patient_name, patient_rut, patient_phone, date, status, reminder_sent)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
  business2Id, z2.lastInsertRowid, 'Roberto Silva', '22222222-2', '+56912222222', '2026-05-15 07:00:00', 'confirmed', 0
);

db.prepare(`INSERT INTO bookings (business_id, service_id, patient_name, patient_rut, patient_phone, date, status, reminder_sent)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
  business2Id, z3.lastInsertRowid, 'Sofía Díaz', '33333333-3', '+56912333333', '2026-05-13 19:30:00', 'completed', 1
);

// Billing para ZenStudio
db.prepare('INSERT INTO billing_customers (business_id, stripe_customer_id, plan, active) VALUES (?, ?, ?, ?)').run(business2Id, 'cus_demo_zenstudio', 'pro', 1);

console.log('✅ ZenStudio Wellness creada');

// NEGOCIO 3: Consultorio Médico "MediCare+"
console.log('🚀 Creando demo: Consultorio Médico MediCare+...');
const b3 = db.prepare('INSERT INTO businesses (slug, name, owner_email, password_hash, phone, plan) VALUES (?, ?, ?, ?, ?, ?)').run('medicare-plus', 'MediCare+ Consultorio', 'admin@medicareplus.cl', demoPasswordHash, '+56912345999', 'clinica');
const business3Id = b3.lastInsertRowid;

// Profesionales en MediCare+
const prof1 = db.prepare('INSERT INTO professionals (business_id, name, specialty) VALUES (?, ?, ?)').run(business3Id, 'Dr. Javier Rodríguez', 'Medicina General');
const prof2 = db.prepare('INSERT INTO professionals (business_id, name, specialty) VALUES (?, ?, ?)').run(business3Id, 'Dra. Elena Pérez', 'Cardiología');
const prof3 = db.prepare('INSERT INTO professionals (business_id, name, specialty) VALUES (?, ?, ?)').run(business3Id, 'Dr. Luis González', 'Neurología');

// Servicios en MediCare+
const m1 = db.prepare('INSERT INTO services (business_id, name, description, duration_min, price) VALUES (?, ?, ?, ?, ?)').run(business3Id, 'Consulta Médica General', 'Primera consulta', 30, 50000);
const m2 = db.prepare('INSERT INTO services (business_id, name, description, duration_min, price) VALUES (?, ?, ?, ?, ?)').run(business3Id, 'Consulta Control', 'Seguimiento', 20, 35000);
const m3 = db.prepare('INSERT INTO services (business_id, name, description, duration_min, price) VALUES (?, ?, ?, ?, ?)').run(business3Id, 'Ecocardiograma', 'Estudio cardíaco', 45, 200000);

// Horarios MediCare+ (Lunes-Viernes 8:00-18:00)
for (let dow = 0; dow < 5; dow++) {
  db.prepare('INSERT INTO schedules (business_id, dow, slots) VALUES (?, ?, ?)').run(business3Id, dow, horarios);
}

// Citas en MediCare+
db.prepare(`INSERT INTO bookings (business_id, service_id, patient_name, patient_rut, patient_phone, date, status, reminder_sent)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
  business3Id, m1.lastInsertRowid, 'Raúl Fernández', '44444444-4', '+56912444444', '2026-05-14 09:00:00', 'confirmed', 0
);

db.prepare(`INSERT INTO bookings (business_id, service_id, patient_name, patient_rut, patient_phone, date, status, reminder_sent)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
  business3Id, m2.lastInsertRowid, 'Claudia Muñoz', '55555555-5', '+56912555555', '2026-05-15 11:00:00', 'pending', 0
);

db.prepare(`INSERT INTO bookings (business_id, service_id, patient_name, patient_rut, patient_phone, date, status, reminder_sent)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
  business3Id, m3.lastInsertRowid, 'David López', '66666666-6', '+56912666666', '2026-05-16 14:30:00', 'confirmed', 0
);

// Pacientes registrados en MediCare+
const pat1 = db.prepare('INSERT INTO patients (business_id, rut, name_encrypted, phone, email) VALUES (?, ?, ?, ?, ?)').run(business3Id, '44444444-4', 'Raúl Fernández', '+56912444444', 'raul.f@email.com');
const pat2 = db.prepare('INSERT INTO patients (business_id, rut, name_encrypted, phone, email) VALUES (?, ?, ?, ?, ?)').run(business3Id, '55555555-5', 'Claudia Muñoz', '+56912555555', 'claudia.m@email.com');

// Consultas médicas
const cons1 = db.prepare('INSERT INTO consultations (business_id, patient_id, date, notes_encrypted, professional_id) VALUES (?, ?, ?, ?, ?)').run(business3Id, pat1.lastInsertRowid, '2026-05-10 09:00:00', 'Paciente refiere dolor de cabeza crónico', prof1.lastInsertRowid);
const cons2 = db.prepare('INSERT INTO consultations (business_id, patient_id, date, notes_encrypted, professional_id) VALUES (?, ?, ?, ?, ?)').run(business3Id, pat2.lastInsertRowid, '2026-05-08 11:00:00', 'Control de presión arterial. Valores normales.', prof2.lastInsertRowid);

// Prescripciones
db.prepare('INSERT INTO prescriptions (consultation_id, description_encrypted) VALUES (?, ?)').run(cons1.lastInsertRowid, 'Ibuprofeno 400mg c/8h x 10 días');
db.prepare('INSERT INTO prescriptions (consultation_id, description_encrypted) VALUES (?, ?)').run(cons2.lastInsertRowid, 'Continuar actual medicación. Control en 1 mes.');

// Billing para MediCare+
db.prepare('INSERT INTO billing_customers (business_id, stripe_customer_id, plan, active) VALUES (?, ?, ?, ?)').run(business3Id, 'cus_demo_medicareplus', 'clinica', 1);

console.log('✅ MediCare+ Consultorio creada');

console.log('\n');
console.log('═'.repeat(60));
console.log('✅ DEMO COMPLETADA CON 3 NEGOCIOS FICTICIOS');
console.log('═'.repeat(60));
console.log('\n📋 Datos de Acceso:\n');
console.log('1️⃣  SmileCare Dental (Plan PRO)');
console.log('   Email: dr.garcia@smileware.com');
console.log('   Pass: demo123');
console.log('   URL: http://localhost:5173/login\n');

console.log('2️⃣  ZenStudio Wellness (Plan PRO)');
console.log('   Email: info@zenstudio.com');
console.log('   Pass: demo123');
console.log('   URL: http://localhost:5173/login\n');

console.log('3️⃣  MediCare+ Consultorio (Plan CLÍNICA)');
console.log('   Email: admin@medicareplus.cl');
console.log('   Pass: demo123');
console.log('   URL: http://localhost:5173/login\n');

console.log('🔗 URLs Públicas de Reserva:\n');
console.log('   SmileCare: http://localhost:5173/book/smileware-dental');
console.log('   ZenStudio: http://localhost:5173/book/zenstudio-yoga');
console.log('   MediCare: http://localhost:5173/book/medicare-plus\n');

console.log('💾 Base de datos en: ./data/demo.db');
console.log('═'.repeat(60));
