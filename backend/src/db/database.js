const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('[db] FATAL: DATABASE_URL no configurada');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[db] Pool error:', err.message);
});

const db = {
  query: (text, params) => pool.query(text, params),
  connect: () => pool.connect(),
  pool,
};

module.exports = db;
