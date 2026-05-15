const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const crypto = require('crypto');

const dbPath = path.join(__dirname, '../', process.env.DB_PATH || 'data/test.db');
const sqliteDb = new sqlite3.Database(dbPath);
const pgPool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function migrateData() {
  try {
    console.log('[MIGRATE-DATA] Starting data migration...');

    const pgClient = await pgPool.connect();

    // Get all data from SQLite
    const businesses = await getFromSqlite('SELECT * FROM businesses').catch(() => []);
    const services = await getFromSqlite('SELECT * FROM services').catch(() => []);
    const schedules = await getFromSqlite('SELECT * FROM schedules').catch(() => []);
    const professionals = await getFromSqlite('SELECT * FROM professionals').catch(() => []);
    const patients = await getFromSqlite('SELECT * FROM patients').catch(() => []);
    const bookings = await getFromSqlite('SELECT * FROM bookings').catch(() => []);
    const consultations = await getFromSqlite('SELECT * FROM consultations').catch(() => []);
    const prescriptions = await getFromSqlite('SELECT * FROM prescriptions').catch(() => []);
    const billing = await getFromSqlite('SELECT * FROM billing_customers').catch(() => []);
    const resets = await getFromSqlite('SELECT * FROM password_resets').catch(() => []);

    console.log(`[MIGRATE-DATA] Found ${businesses.length} businesses`);
    console.log(`[MIGRATE-DATA] Found ${services.length} services`);
    console.log(`[MIGRATE-DATA] Found ${patients.length} patients`);
    console.log(`[MIGRATE-DATA] Found ${bookings.length} bookings`);

    // Migrate businesses
    for (const b of businesses) {
      const email = b.email || `business-${b.id}@placeholder.local`;
      await pgClient.query(
        'INSERT INTO businesses (id, email, password_hash, phone, plan, active, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [b.id, email, b.password_hash, b.phone, b.plan || 'basic', b.active !== false, b.created_at, b.updated_at]
      );
    }
    console.log('[MIGRATE-DATA] ✓ Businesses migrated');

    // Migrate services
    for (const s of services) {
      await pgClient.query(
        'INSERT INTO services (id, business_id, name, duration_min, price, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
        [s.id, s.business_id, s.name, s.duration_min, s.price, s.created_at]
      );
    }
    console.log('[MIGRATE-DATA] ✓ Services migrated');

    // Migrate schedules (convert JSON text to JSONB)
    for (const sc of schedules) {
      const slots = typeof sc.slots === 'string' ? JSON.parse(sc.slots) : sc.slots;
      await pgClient.query(
        'INSERT INTO schedules (id, business_id, day_of_week, slots, created_at) VALUES ($1, $2, $3, $4, $5)',
        [sc.id, sc.business_id, sc.day_of_week, JSON.stringify(slots), sc.created_at]
      );
    }
    console.log('[MIGRATE-DATA] ✓ Schedules migrated');

    // Migrate professionals
    for (const p of professionals) {
      await pgClient.query(
        'INSERT INTO professionals (id, business_id, name, specialty, created_at) VALUES ($1, $2, $3, $4, $5)',
        [p.id, p.business_id, p.name, p.specialty, p.created_at]
      );
    }
    console.log('[MIGRATE-DATA] ✓ Professionals migrated');

    // Migrate patients (encrypt name with AES-256)
    for (const pt of patients) {
      const encryptedName = encryptData(pt.name);
      await pgClient.query(
        'INSERT INTO patients (id, business_id, rut, name, phone, email, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [pt.id, pt.business_id, pt.rut, encryptedName, pt.phone, pt.email, pt.created_at]
      );
    }
    console.log('[MIGRATE-DATA] ✓ Patients migrated');

    // Migrate bookings (skip incomplete records)
    for (const bk of bookings) {
      if (!bk.service_id || !bk.patient_rut) {
        console.log(`[MIGRATE-DATA] ⚠️ Skipping incomplete booking ${bk.id}`);
        continue;
      }
      await pgClient.query(
        'INSERT INTO bookings (id, business_id, service_id, patient_rut, booking_date, booking_time, status, reminder_sent, cancel_token, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
        [bk.id, bk.business_id, bk.service_id, bk.patient_rut, bk.booking_date, bk.booking_time, bk.status || 'pending', bk.reminder_sent || false, bk.cancel_token, bk.created_at]
      );
    }
    console.log('[MIGRATE-DATA] ✓ Bookings migrated');

    // Migrate consultations
    for (const c of consultations) {
      const encryptedNotes = c.notes ? encryptData(c.notes) : null;
      await pgClient.query(
        'INSERT INTO consultations (id, business_id, patient_id, professional_id, consultation_date, notes, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [c.id, c.business_id, c.patient_id, c.professional_id, c.consultation_date, encryptedNotes, c.created_at]
      );
    }
    console.log('[MIGRATE-DATA] ✓ Consultations migrated');

    // Migrate prescriptions
    for (const pr of prescriptions) {
      const encryptedDesc = encryptData(pr.description);
      await pgClient.query(
        'INSERT INTO prescriptions (id, business_id, consultation_id, description, created_at) VALUES ($1, $2, $3, $4, $5)',
        [pr.id, pr.business_id, pr.consultation_id, encryptedDesc, pr.created_at]
      );
    }
    console.log('[MIGRATE-DATA] ✓ Prescriptions migrated');

    // Migrate billing
    for (const b of billing) {
      await pgClient.query(
        'INSERT INTO billing_customers (id, business_id, stripe_customer_id, plan, active, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [b.id, b.business_id, b.stripe_customer_id, b.plan, b.active || false, b.created_at, b.updated_at]
      );
    }
    console.log('[MIGRATE-DATA] ✓ Billing migrated');

    // Migrate password resets
    for (const r of resets) {
      await pgClient.query(
        'INSERT INTO password_resets (id, business_id, token_hash, expires_at, created_at) VALUES ($1, $2, $3, $4, $5)',
        [r.id, r.business_id, r.token_hash, r.expires_at, r.created_at]
      );
    }
    console.log('[MIGRATE-DATA] ✓ Password resets migrated');

    pgClient.release();
    console.log('[MIGRATE-DATA] All data migrated successfully!');
    process.exit(0);
  } catch (err) {
    console.error('[MIGRATE-DATA] Error:', err);
    process.exit(1);
  } finally {
    sqliteDb.close();
    await pgPool.end();
  }
}

function getFromSqlite(sql) {
  return new Promise((resolve, reject) => {
    sqliteDb.all(sql, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function encryptData(data) {
  if (!data) return null;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(process.env.ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return Buffer.from(iv.toString('hex') + ':' + encrypted);
}

migrateData();
