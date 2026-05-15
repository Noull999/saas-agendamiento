#!/usr/bin/env node
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigrations() {
  const poolConfig = process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'saas_dev',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
      };

  const adminPool = new Pool({ ...poolConfig, database: 'postgres' });

  try {
    console.log('[MIGRATION] Conectando a PostgreSQL...');

    // Test connection to postgres database first
    await adminPool.query('SELECT NOW()');
    console.log('[MIGRATION] Conexión exitosa a PostgreSQL');

    const dbName = poolConfig.database || 'saas_dev';

    // Create database if it doesn't exist
    console.log(`[MIGRATION] Creando base de datos ${dbName}...`);
    await adminPool.query(`CREATE DATABASE ${dbName} ENCODING 'UTF8'`);
    console.log(`[MIGRATION] Base de datos ${dbName} creada`);
  } catch (err) {
    if (err.message.includes('already exists')) {
      console.log('[MIGRATION] Base de datos ya existe, continuando...');
    } else if (err.message.includes('does not exist')) {
      console.error('[MIGRATION] No se puede crear BD:', err.message);
      process.exit(1);
    } else {
      console.error('[MIGRATION] Error:', err.message);
    }
  } finally {
    await adminPool.end();
  }

  // Now connect to the actual app database
  const appPool = new Pool(poolConfig);

  try {
    console.log('[MIGRATION] Ejecutando schema SQL...');

    const schemaPath = path.join(__dirname, '../migrations/001_create_initial_schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    await appPool.query(schema);
    console.log('[MIGRATION] ✓ Schema creado exitosamente');

    // Add missing columns if needed
    console.log('[MIGRATION] Verificando columnas faltantes...');

    const checkCols = await appPool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'businesses'
    `);
    const cols = checkCols.rows.map(r => r.column_name);

    if (!cols.includes('token_version')) {
      console.log('[MIGRATION] Agregando columna token_version...');
      await appPool.query('ALTER TABLE businesses ADD COLUMN token_version INTEGER DEFAULT 0');
    }

    if (!cols.includes('slug')) {
      console.log('[MIGRATION] Agregando columna slug...');
      await appPool.query('ALTER TABLE businesses ADD COLUMN slug VARCHAR(255) UNIQUE');
    }

    if (!cols.includes('vertical')) {
      console.log('[MIGRATION] Agregando columna vertical...');
      await appPool.query('ALTER TABLE businesses ADD COLUMN vertical VARCHAR(50)');
    }

    if (!cols.includes('description')) {
      console.log('[MIGRATION] Agregando columna description...');
      await appPool.query('ALTER TABLE businesses ADD COLUMN description TEXT');
    }

    if (!cols.includes('owner_email')) {
      console.log('[MIGRATION] Agregando columna owner_email...');
      await appPool.query('ALTER TABLE businesses ADD COLUMN owner_email VARCHAR(255)');
    }

    if (!cols.includes('updated_at')) {
      console.log('[MIGRATION] Agregando columna updated_at...');
      await appPool.query('ALTER TABLE businesses ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP');
    }

    // Check professionals table for missing columns
    const profCols = await appPool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'professionals'
    `);
    const profColNames = profCols.rows.map(r => r.column_name);

    if (!profColNames.includes('email')) {
      console.log('[MIGRATION] Agregando columna email a professionals...');
      await appPool.query('ALTER TABLE professionals ADD COLUMN email VARCHAR(255)');
    }

    if (!profColNames.includes('updated_at')) {
      console.log('[MIGRATION] Agregando columna updated_at a professionals...');
      await appPool.query('ALTER TABLE professionals ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP');
    }

    if (!profColNames.includes('active')) {
      console.log('[MIGRATION] Agregando columna active a professionals...');
      await appPool.query('ALTER TABLE professionals ADD COLUMN active BOOLEAN DEFAULT true');
    }

    // Check consultations table
    const consCols = await appPool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'consultations'
    `);
    const consColNames = consCols.rows.map(r => r.column_name);

    if (!consColNames.includes('booking_id')) {
      console.log('[MIGRATION] Agregando columna booking_id a consultations...');
      await appPool.query(`
        ALTER TABLE consultations ADD COLUMN booking_id INTEGER REFERENCES bookings(id)
      `);
    }

    if (!consColNames.includes('diagnosis')) {
      console.log('[MIGRATION] Agregando columna diagnosis a consultations...');
      await appPool.query('ALTER TABLE consultations ADD COLUMN diagnosis BYTEA');
    }

    if (!consColNames.includes('treatment')) {
      console.log('[MIGRATION] Agregando columna treatment a consultations...');
      await appPool.query('ALTER TABLE consultations ADD COLUMN treatment BYTEA');
    }

    if (!consColNames.includes('updated_at')) {
      console.log('[MIGRATION] Agregando columna updated_at a consultations...');
      await appPool.query('ALTER TABLE consultations ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP');
    }

    // Check patients table
    const patientCols = await appPool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'patients'
    `);
    const patientColNames = patientCols.rows.map(r => r.column_name);

    if (!patientColNames.includes('allergies')) {
      console.log('[MIGRATION] Agregando columna allergies a patients...');
      await appPool.query('ALTER TABLE patients ADD COLUMN allergies BYTEA');
    }

    if (!patientColNames.includes('background')) {
      console.log('[MIGRATION] Agregando columna background a patients...');
      await appPool.query('ALTER TABLE patients ADD COLUMN background BYTEA');
    }

    if (!patientColNames.includes('updated_at')) {
      console.log('[MIGRATION] Agregando columna updated_at a patients...');
      await appPool.query('ALTER TABLE patients ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP');
    }

    // Check bookings table
    const bookingCols = await appPool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'bookings'
    `);
    const bookingColNames = bookingCols.rows.map(r => r.column_name);

    if (!bookingColNames.includes('patient_id')) {
      console.log('[MIGRATION] Agregando columna patient_id a bookings...');
      await appPool.query(`
        ALTER TABLE bookings ADD COLUMN patient_id INTEGER REFERENCES patients(id)
      `);
    }

    if (!bookingColNames.includes('professional_id')) {
      console.log('[MIGRATION] Agregando columna professional_id a bookings...');
      await appPool.query(`
        ALTER TABLE bookings ADD COLUMN professional_id INTEGER REFERENCES professionals(id)
      `);
    }

    if (!bookingColNames.includes('datetime_iso')) {
      console.log('[MIGRATION] Agregando columna datetime_iso a bookings...');
      await appPool.query(`
        ALTER TABLE bookings ADD COLUMN datetime_iso TIMESTAMP WITH TIME ZONE
      `);
    }

    if (!bookingColNames.includes('updated_at')) {
      console.log('[MIGRATION] Agregando columna updated_at a bookings...');
      await appPool.query('ALTER TABLE bookings ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP');
    }

    // Check prescriptions table
    const prescriptionCols = await appPool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'prescriptions'
    `);
    const prescriptionColNames = prescriptionCols.rows.map(r => r.column_name);

    if (!prescriptionColNames.includes('content')) {
      console.log('[MIGRATION] Agregando columna content a prescriptions...');
      await appPool.query(`
        ALTER TABLE prescriptions ADD COLUMN content BYTEA
      `);
    }

    if (!prescriptionColNames.includes('updated_at')) {
      console.log('[MIGRATION] Agregando columna updated_at a prescriptions...');
      await appPool.query('ALTER TABLE prescriptions ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP');
    }

    console.log('[MIGRATION] ✓ Todas las migraciones completadas');
  } catch (err) {
    console.error('[MIGRATION] Error ejecutando schema:', err.message);
    if (err.detail) console.error('[MIGRATION] Detalle:', err.detail);
    process.exit(1);
  } finally {
    await appPool.end();
  }
}

runMigrations();
