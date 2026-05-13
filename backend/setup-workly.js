#!/usr/bin/env node
// Crea (o actualiza) el negocio 'workly' en el SaaS para que el bot de WhatsApp pueda sincronizar reservas.
// Uso: node setup-workly.js  (desde la carpeta backend/)
require('dotenv').config({ path: '.env' });
const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const path = require('path');

const TARGET_SLUG  = 'workly';
const TARGET_EMAIL = 'joseestebanasencio@gmail.com';
const DEFAULT_PASS = 'workly2026';

const dbPath = process.env.DB_PATH || './data/saas.db';
const db = new DatabaseSync(path.resolve(dbPath));
db.exec('PRAGMA foreign_keys = ON');

const bySlug = db.prepare('SELECT * FROM businesses WHERE slug = ?').get(TARGET_SLUG);
if (bySlug) {
  console.log(`✅ El negocio 'workly' ya existe (id=${bySlug.id}, email=${bySlug.owner_email})`);
  console.log('   No se necesita hacer nada más.');
  db.close(); process.exit(0);
}

const byEmail = db.prepare('SELECT * FROM businesses WHERE owner_email = ?').get(TARGET_EMAIL.toLowerCase());
if (byEmail) {
  db.prepare('UPDATE businesses SET slug = ? WHERE id = ?').run(TARGET_SLUG, byEmail.id);
  console.log(`✅ Slug de "${byEmail.name}" actualizado a 'workly' (id=${byEmail.id})`);
  console.log(`   Inicia sesión con ${TARGET_EMAIL} en http://localhost:5173`);
  db.close(); process.exit(0);
}

const hash = bcrypt.hashSync(DEFAULT_PASS, 10);
const res  = db.prepare(`
  INSERT INTO businesses (slug, name, owner_email, password_hash, plan, vertical, specialty)
  VALUES ('workly', 'Workly', ?, ?, 'basic', 'salud', 'general')
`).run(TARGET_EMAIL.toLowerCase(), hash);

console.log(`✅ Negocio 'workly' creado (id=${res.lastInsertRowid})`);
console.log(`   Email:    ${TARGET_EMAIL}`);
console.log(`   Password: ${DEFAULT_PASS}`);
console.log(`   URL:      http://localhost:5173`);
db.close();
