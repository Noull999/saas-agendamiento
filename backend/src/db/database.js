const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'saas_postgres',
  user: process.env.DB_USER || 'saas_app',
  password: process.env.DB_PASSWORD || 'password',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client', err);
});

pool.on('connect', () => {
  console.log('[DB] New connection established');
});

// Test connection on startup
pool.query('SELECT NOW()')
  .then(() => console.log('[DB] PostgreSQL connected successfully'))
  .catch(err => {
    console.error('[DB] Failed to connect to PostgreSQL:', err.message);
    process.exit(1);
  });

module.exports = pool;
