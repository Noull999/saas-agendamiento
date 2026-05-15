const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { Pool } = require('pg');
const fs = require('fs');

async function runMigrations() {
  console.log('[MIGRATE] Config:', {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
  });

  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  try {
    console.log('[MIGRATE] Connecting to PostgreSQL...');
    const client = await pool.connect();
    console.log('[MIGRATE] Connected!');

    // Get all migration files
    const migrationsDir = path.join(__dirname, '../../migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      console.log(`[MIGRATE] Executing ${file}...`);
      await client.query(sql);
      console.log(`[MIGRATE] ✓ ${file}`);
    }

    client.release();
    console.log('[MIGRATE] All migrations completed!');
    process.exit(0);
  } catch (err) {
    console.error('[MIGRATE] Error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
