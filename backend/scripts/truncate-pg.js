const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { Pool } = require('pg');

async function truncateTables() {
  const pgPool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  try {
    const client = await pgPool.connect();
    console.log('[TRUNCATE] Truncating all tables...');

    await client.query('TRUNCATE TABLE audit_logs CASCADE');
    await client.query('TRUNCATE TABLE password_resets CASCADE');
    await client.query('TRUNCATE TABLE billing_customers CASCADE');
    await client.query('TRUNCATE TABLE prescriptions CASCADE');
    await client.query('TRUNCATE TABLE consultations CASCADE');
    await client.query('TRUNCATE TABLE bookings CASCADE');
    await client.query('TRUNCATE TABLE patients CASCADE');
    await client.query('TRUNCATE TABLE professionals CASCADE');
    await client.query('TRUNCATE TABLE schedules CASCADE');
    await client.query('TRUNCATE TABLE services CASCADE');
    await client.query('TRUNCATE TABLE businesses CASCADE');

    console.log('[TRUNCATE] All tables truncated!');
    client.release();
    process.exit(0);
  } catch (err) {
    console.error('[TRUNCATE] Error:', err);
    process.exit(1);
  } finally {
    await pgPool.end();
  }
}

truncateTables();
