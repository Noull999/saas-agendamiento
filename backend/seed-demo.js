// Seed de demostración — apunta a demo.db, no toca saas.db
// Uso: DB_PATH=./data/demo.db node seed-demo.js
require('dotenv').config();
process.env.DB_PATH = process.env.DB_PATH || './data/demo.db';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '0000000000000000000000000000000000000000000000000000000000000001';

const db = require('./src/db/database');
const bcryptjs = require('bcryptjs');
const { encrypt } = require('./src/lib/crypto');

// Limpiar datos existentes en demo.db
db.exec('PRAGMA foreign_keys = OFF');
[
  'prescriptions', 'consultations', 'patients', 'bookings',
  'schedules', 'services', 'professionals', 'businesses',
].forEach(t => db.exec(`DELETE FROM ${t}`));
db.exec('PRAGMA foreign_keys = ON');

const pw = bcryptjs.hashSync('demo123', 10);

// ─── NEGOCIO 1: SmileCare Dental ────────────────────────────────────────────
console.log('Creando SmileCare Dental...');
const b1 = db.prepare(
  'INSERT INTO businesses (slug, name, owner_email, password_hash, phone, plan, vertical, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
).run('smileware-dental', 'SmileCare Dental', 'dr.garcia@smileware.com', pw, '+56987654321', 'pro', 'salud',
  'Clínica dental con atención de excelencia. Limpieza, obturaciones e implantes.');

const b1id = b1.lastInsertRowid;

const p1a = db.prepare('INSERT INTO professionals (business_id, name, specialty) VALUES (?, ?, ?)').run(b1id, 'Dr. Carlos García', 'Odontología General');
const p1b = db.prepare('INSERT INTO professionals (business_id, name, specialty) VALUES (?, ?, ?)').run(b1id, 'Dra. Patricia López', 'Ortodoncia');

const s1a = db.prepare('INSERT INTO services (business_id, name, description, duration_min, price) VALUES (?, ?, ?, ?, ?)').run(b1id, 'Limpieza Dental', 'Higiene y profilaxis', 45, 85000);
const s1b = db.prepare('INSERT INTO services (business_id, name, description, duration_min, price) VALUES (?, ?, ?, ?, ?)').run(b1id, 'Obturación', 'Reparación de caries', 60, 120000);
db.prepare('INSERT INTO services (business_id, name, description, duration_min, price) VALUES (?, ?, ?, ?, ?)').run(b1id, 'Implante Dental', 'Implante con corona', 120, 850000);

// Horarios Lun-Vie 08-17, Sáb 09-14
const lv = JSON.stringify([{ start: '08:00', end: '17:00' }]);
for (let d = 0; d < 5; d++) db.prepare('INSERT INTO schedules (business_id, dow, slots) VALUES (?, ?, ?)').run(b1id, d, lv);
db.prepare('INSERT INTO schedules (business_id, dow, slots) VALUES (?, ?, ?)').run(b1id, 5, JSON.stringify([{ start: '09:00', end: '14:00' }]));

// Fechas relativas a hoy para que el dashboard siempre muestre datos
function isoDay(offsetDays, time = '09:00:00') {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10) + 'T' + time;
}

// Reservas (schema real: client_name, client_rut, datetime_iso, status)
db.prepare(`INSERT INTO bookings (business_id, service_id, client_name, client_rut, client_phone, datetime_iso, status, source)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'web')`)
  .run(b1id, s1a.lastInsertRowid, 'Juan Pérez', '12345678-9', '+56912345678', isoDay(0, '09:00:00'), 'confirmed');

db.prepare(`INSERT INTO bookings (business_id, service_id, client_name, client_rut, client_phone, datetime_iso, status, source)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'web')`)
  .run(b1id, s1b.lastInsertRowid, 'María González', '98765432-1', '+56987654321', isoDay(0, '10:30:00'), 'confirmed');

db.prepare(`INSERT INTO bookings (business_id, service_id, client_name, client_rut, client_phone, datetime_iso, status, source)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'web')`)
  .run(b1id, s1a.lastInsertRowid, 'Sofía Vargas', '11223344-5', '+56911223344', isoDay(0, '14:00:00'), 'confirmed');

db.prepare(`INSERT INTO bookings (business_id, service_id, client_name, client_rut, client_phone, datetime_iso, status, source)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'web')`)
  .run(b1id, s1b.lastInsertRowid, 'Carlos López', '55555555-5', '+56998765432', isoDay(1, '09:00:00'), 'confirmed');

db.prepare(`INSERT INTO bookings (business_id, service_id, client_name, client_rut, client_phone, datetime_iso, status, source)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'web')`)
  .run(b1id, s1a.lastInsertRowid, 'Andrés Morales', '99887766-3', '+56999887766', isoDay(1, '11:00:00'), 'confirmed');

db.prepare(`INSERT INTO bookings (business_id, service_id, client_name, client_rut, client_phone, datetime_iso, status, source)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'web')`)
  .run(b1id, s1a.lastInsertRowid, 'Ana Torres', '77665544-2', '+56977665544', isoDay(-1, '10:00:00'), 'completed');

db.prepare(`INSERT INTO bookings (business_id, service_id, client_name, client_rut, client_phone, datetime_iso, status, source)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'web')`)
  .run(b1id, s1b.lastInsertRowid, 'Roberto Soto', '44332211-6', '+56944332211', isoDay(-1, '15:00:00'), 'no_show');

// Pacientes registrados en SmileCare (historial odontológico)
const ptS = [
  { rut: '12345678-9', name: 'Juan Pérez',     phone: '+56912345678', email: 'juan.perez@gmail.com' },
  { rut: '98765432-1', name: 'María González', phone: '+56987654321', email: 'maria.g@gmail.com'    },
  { rut: '55555555-5', name: 'Carlos López',   phone: '+56998765432', email: 'carlos.l@gmail.com'   },
  { rut: '11223344-5', name: 'Sofía Vargas',   phone: '+56911223344', email: 'sofia.v@gmail.com'    },
  { rut: '99887766-3', name: 'Andrés Morales', phone: '+56999887766', email: null                   },
].map(p => ({
  ...p,
  id: db.prepare('INSERT INTO patients (business_id, rut, name, phone, email) VALUES (?, ?, ?, ?, ?)').run(b1id, p.rut, p.name, p.phone, p.email).lastInsertRowid,
}));

console.log('  SmileCare Dental OK');

// ─── NEGOCIO 2: ZenStudio Wellness ──────────────────────────────────────────
console.log('Creando ZenStudio Wellness...');
const b2 = db.prepare(
  'INSERT INTO businesses (slug, name, owner_email, password_hash, phone, plan, vertical, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
).run('zenstudio-yoga', 'ZenStudio Wellness', 'info@zenstudio.com', pw, '+56912345000', 'pro', 'belleza',
  'Centro de bienestar integral: yoga, pilates y masajes terapéuticos.');

const b2id = b2.lastInsertRowid;

db.prepare('INSERT INTO professionals (business_id, name, specialty) VALUES (?, ?, ?)').run(b2id, 'Natalia Silva', 'Yoga y Meditación');
db.prepare('INSERT INTO professionals (business_id, name, specialty) VALUES (?, ?, ?)').run(b2id, 'Marco Rodríguez', 'Pilates');

const s2a = db.prepare('INSERT INTO services (business_id, name, description, duration_min, price) VALUES (?, ?, ?, ?, ?)').run(b2id, 'Clase de Yoga', 'Vinyasa 60 min', 60, 15000);
const s2b = db.prepare('INSERT INTO services (business_id, name, description, duration_min, price) VALUES (?, ?, ?, ?, ?)').run(b2id, 'Pilates Mat', 'Colchoneta 45 min', 45, 12000);
db.prepare('INSERT INTO services (business_id, name, description, duration_min, price) VALUES (?, ?, ?, ?, ?)').run(b2id, 'Masaje Relajante', 'Cuerpo completo 90 min', 90, 50000);

const todo = JSON.stringify([{ start: '07:00', end: '20:00' }]);
for (let d = 0; d < 7; d++) db.prepare('INSERT INTO schedules (business_id, dow, slots) VALUES (?, ?, ?)').run(b2id, d, todo);

db.prepare(`INSERT INTO bookings (business_id, service_id, client_name, client_phone, datetime_iso, status, source)
            VALUES (?, ?, ?, ?, ?, ?, 'web')`)
  .run(b2id, s2a.lastInsertRowid, 'Andrea Martínez', '+56912111111', isoDay(0, '18:00:00'), 'confirmed');

db.prepare(`INSERT INTO bookings (business_id, service_id, client_name, client_phone, datetime_iso, status, source)
            VALUES (?, ?, ?, ?, ?, ?, 'web')`)
  .run(b2id, s2b.lastInsertRowid, 'Roberto Silva', '+56912222222', isoDay(0, '07:00:00'), 'completed');

db.prepare(`INSERT INTO bookings (business_id, service_id, client_name, client_phone, datetime_iso, status, source)
            VALUES (?, ?, ?, ?, ?, ?, 'web')`)
  .run(b2id, s2a.lastInsertRowid, 'Valentina Mora', '+56912333333', isoDay(1, '10:00:00'), 'confirmed');

console.log('  ZenStudio Wellness OK');

// ─── NEGOCIO 3: MediCare+ ────────────────────────────────────────────────────
console.log('Creando MediCare+ Consultorio...');
const b3 = db.prepare(
  'INSERT INTO businesses (slug, name, owner_email, password_hash, phone, plan, vertical, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
).run('medicare-plus', 'MediCare+ Consultorio', 'admin@medicareplus.cl', pw, '+56912345999', 'pro', 'salud',
  'Consultorio médico con especialidades: medicina general, cardiología y neurología.');

const b3id = b3.lastInsertRowid;

const pr3a = db.prepare('INSERT INTO professionals (business_id, name, specialty) VALUES (?, ?, ?)').run(b3id, 'Dr. Javier Rodríguez', 'Medicina General');
const pr3b = db.prepare('INSERT INTO professionals (business_id, name, specialty) VALUES (?, ?, ?)').run(b3id, 'Dra. Elena Pérez', 'Cardiología');

const s3a = db.prepare('INSERT INTO services (business_id, name, description, duration_min, price) VALUES (?, ?, ?, ?, ?)').run(b3id, 'Consulta Médica', 'Primera consulta', 30, 50000);
const s3b = db.prepare('INSERT INTO services (business_id, name, description, duration_min, price) VALUES (?, ?, ?, ?, ?)').run(b3id, 'Control', 'Consulta de seguimiento', 20, 35000);
db.prepare('INSERT INTO services (business_id, name, description, duration_min, price) VALUES (?, ?, ?, ?, ?)').run(b3id, 'Ecocardiograma', 'Estudio cardíaco', 45, 200000);

for (let d = 0; d < 5; d++) db.prepare('INSERT INTO schedules (business_id, dow, slots) VALUES (?, ?, ?)').run(b3id, d, JSON.stringify([{ start: '08:00', end: '18:00' }]));

// Pacientes con historial
const pt3a = db.prepare('INSERT INTO patients (business_id, rut, name, phone, email, birth_date) VALUES (?, ?, ?, ?, ?, ?)').run(b3id, '44444444-4', 'Raúl Fernández',  '+56912444444', 'raul.f@email.com',   '1978-03-12');
const pt3b = db.prepare('INSERT INTO patients (business_id, rut, name, phone, email, birth_date) VALUES (?, ?, ?, ?, ?, ?)').run(b3id, '55555556-5', 'Claudia Muñoz',    '+56912555555', 'claudia.m@email.com','1972-07-25');
const pt3c = db.prepare('INSERT INTO patients (business_id, rut, name, phone, email, birth_date) VALUES (?, ?, ?, ?, ?, ?)').run(b3id, '66666666-6', 'David López',      '+56912666666', 'david.l@email.com',  '1996-11-03');
db.prepare('INSERT INTO patients (business_id, rut, name, phone, email, birth_date) VALUES (?, ?, ?, ?, ?, ?)').run(b3id, '77777777-7', 'Patricia Soto',    '+56912777777', 'patricia.s@email.com','1965-05-18');
db.prepare('INSERT INTO patients (business_id, rut, name, phone, email, birth_date) VALUES (?, ?, ?, ?, ?, ?)').run(b3id, '88888888-8', 'Marcos Ibáñez',    '+56912888888', 'marcos.i@email.com', '1989-09-30');
db.prepare('INSERT INTO patients (business_id, rut, name, phone, email, birth_date) VALUES (?, ?, ?, ?, ?, ?)').run(b3id, '11112222-3', 'Valentina Ríos',   '+56911112222', null,                 '2001-02-14');
db.prepare('INSERT INTO patients (business_id, rut, name, phone, email, birth_date) VALUES (?, ?, ?, ?, ?, ?)').run(b3id, '33334444-5', 'Jorge Castillo',   '+56933334444', 'jorge.c@email.com',  '1955-12-08');

// Reservas vinculadas a pacientes
const bk3a = db.prepare(`INSERT INTO bookings (business_id, service_id, client_name, client_rut, client_phone, datetime_iso, status, source, patient_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'web', ?)`)
  .run(b3id, s3a.lastInsertRowid, 'Raúl Fernández', '44444444-4', '+56912444444', isoDay(0, '09:00:00'), 'confirmed', pt3a.lastInsertRowid);

const bk3b = db.prepare(`INSERT INTO bookings (business_id, service_id, client_name, client_rut, client_phone, datetime_iso, status, source, patient_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'web', ?)`)
  .run(b3id, s3b.lastInsertRowid, 'Claudia Muñoz', '55555556-5', '+56912555555', isoDay(0, '11:00:00'), 'confirmed', pt3b.lastInsertRowid);

db.prepare(`INSERT INTO bookings (business_id, service_id, client_name, client_rut, client_phone, datetime_iso, status, source, patient_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'web', ?)`)
  .run(b3id, s3a.lastInsertRowid, 'David López', '66666666-6', '+56912666666', isoDay(0, '14:30:00'), 'confirmed', pt3c.lastInsertRowid);

db.prepare(`INSERT INTO bookings (business_id, service_id, client_name, client_rut, client_phone, datetime_iso, status, source, patient_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'web', ?)`)
  .run(b3id, s3b.lastInsertRowid, 'Patricia Soto', '77777777-7', '+56912777777', isoDay(0, '16:00:00'), 'confirmed', null);

db.prepare(`INSERT INTO bookings (business_id, service_id, client_name, client_rut, client_phone, datetime_iso, status, source, patient_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'web', ?)`)
  .run(b3id, s3a.lastInsertRowid, 'Marcos Ibáñez', '88888888-8', '+56912888888', isoDay(1, '10:00:00'), 'confirmed', null);

db.prepare(`INSERT INTO bookings (business_id, service_id, client_name, client_rut, client_phone, datetime_iso, status, source, patient_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'web', ?)`)
  .run(b3id, s3b.lastInsertRowid, 'Jorge Castillo', '33334444-5', '+56933334444', isoDay(-1, '09:00:00'), 'completed', null);

function insertConsultas(businessId, patientId, bookingId, profId, lista) {
  lista.forEach(({ notas, diag, trat, dias }) => {
    const c = db.prepare(`INSERT INTO consultations (business_id, patient_id, booking_id, professional_id, notes, diagnosis, treatment, created_at)
                           VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', ?))`)
      .run(businessId, patientId, bookingId, profId, encrypt(notas), encrypt(diag), encrypt(trat), `-${dias} days`);
    db.prepare('INSERT INTO prescriptions (consultation_id, content) VALUES (?, ?)').run(c.lastInsertRowid, encrypt(trat));
  });
}

// Historial de Raúl — 8 consultas
insertConsultas(b3id, pt3a.lastInsertRowid, bk3a.lastInsertRowid, pr3a.lastInsertRowid, [
  { notas: 'Paciente refiere dolor de cabeza crónico, más intenso por las tardes. Tensional.', diag: 'Cefalea tensional', trat: 'Ibuprofeno 400mg c/8h x 10 días. Técnicas de relajación.', dias: 120 },
  { notas: 'Control cefalea. Mejoría parcial con ibuprofeno. Persiste tensión cervical.', diag: 'Cefalea tensional en remisión parcial', trat: 'Fisioterapia cervical 6 sesiones. Mantener ibuprofeno SOS.', dias: 100 },
  { notas: 'Gripe con fiebre 38.5°C, tos seca, malestar general. Inicio hace 2 días.', diag: 'Influenza', trat: 'Paracetamol 1g c/8h + reposo 5 días. Control si empeora.', dias: 80 },
  { notas: 'Dolor lumbar agudo post-esfuerzo al cargar cajas. Sin irradiación a piernas.', diag: 'Lumbalgia mecánica aguda', trat: 'Clonazepam 0.5mg + Naproxeno 550mg c/12h x 5 días. Reposo relativo.', dias: 60 },
  { notas: 'Control anual preventivo. Paciente asintomático. PA 120/80. Peso 78kg.', diag: 'Paciente sano', trat: 'Sin indicaciones farmacológicas. Ejercicio aeróbico 30 min/día.', dias: 40 },
  { notas: 'Rinitis alérgica estacional. Estornudos, congestión nasal y picazón ocular.', diag: 'Rinitis alérgica perenne', trat: 'Loratadina 10mg c/24h + spray nasal corticoide.', dias: 25 },
  { notas: 'Seguimiento rinitis. Buena respuesta al tratamiento. Sin síntomas activos.', diag: 'Rinitis alérgica controlada', trat: 'Mantener Loratadina según necesidad.', dias: 10 },
  { notas: 'Consulta por ardor gástrico frecuente post-prandial, 3 semanas de evolución.', diag: 'Gastritis crónica superficial (probable)', trat: 'Omeprazol 20mg en ayunas x 4 semanas. Dieta blanda. Evitar AINES.', dias: 3 },
]);

// Historial de Claudia — 5 consultas
insertConsultas(b3id, pt3b.lastInsertRowid, bk3b.lastInsertRowid, pr3b.lastInsertRowid, [
  { notas: 'Paciente de 52 años, HTA diagnosticada hace 6 meses. PA 145/95 en consulta. Sin síntomas.', diag: 'Hipertensión arterial grado I', trat: 'Losartán 50mg c/24h. Dieta hiposódica. Ejercicio moderado.', dias: 90 },
  { notas: 'Control PA. 138/88. Leve mejoría con medicación. Refiere mareos ocasionales.', diag: 'HTA en tratamiento — control', trat: 'Ajuste dosis: Losartán 100mg c/24h. Control en 3 semanas.', dias: 65 },
  { notas: 'Control PA. 130/82. Buena respuesta al ajuste. Sin mareos. Examen físico normal.', diag: 'HTA controlada', trat: 'Continuar Losartán 100mg. Próximo control en 2 meses.', dias: 45 },
  { notas: 'Control cardiológico preventivo solicitado por médico general. ECG normal. Ecocardio pendiente.', diag: 'Sin cardiopatía estructural evidente', trat: 'Ecocardiograma de control en 6 meses. Mantener tratamiento actual.', dias: 20 },
  { notas: 'Control PA. 128/80. Valores en rango óptimo. Paciente refiere sentirse muy bien.', diag: 'HTA controlada — óptima', trat: 'Mantener régimen actual. Control en 3 meses.', dias: 5 },
]);

// Historial de David — 3 consultas
insertConsultas(b3id, pt3c.lastInsertRowid, null, pr3a.lastInsertRowid, [
  { notas: 'Primera consulta. Paciente joven 28 años, dolor torácico atípico. ECG normal. Probable origen muscular.', diag: 'Dolor torácico de origen musculo-esquelético', trat: 'Ibuprofeno 600mg c/8h x 5 días. Control si persiste.', dias: 30 },
  { notas: 'Dolor torácico resuelto. Consulta por ansiedad y dificultad para dormir, relacionados con estrés laboral.', diag: 'Trastorno de ansiedad situacional', trat: 'Derivación a psicólogo. Técnicas de respiración. Melatonina 2mg al dormir.', dias: 15 },
  { notas: 'Seguimiento ansiedad. Paciente en psicología. Mejoría notable en calidad del sueño.', diag: 'Ansiedad situacional en mejoría', trat: 'Continuar psicología. Mantener melatonina según necesidad.', dias: 2 },
]);

console.log('  MediCare+ Consultorio OK');

console.log('\n' + '='.repeat(60));
console.log('DEMO LISTA — 3 negocios ficticios creados');
console.log('='.repeat(60));
console.log('\nCredenciales:\n');
console.log('  SmileCare Dental (Plan PRO)');
console.log('    Email : dr.garcia@smileware.com');
console.log('    Pass  : demo123');
console.log('    Agenda: http://localhost:5173/book/smileware-dental\n');
console.log('  ZenStudio Wellness (Plan PRO)');
console.log('    Email : info@zenstudio.com');
console.log('    Pass  : demo123');
console.log('    Agenda: http://localhost:5173/book/zenstudio-yoga\n');
console.log('  MediCare+ Consultorio (Plan PRO)');
console.log('    Email : admin@medicareplus.cl');
console.log('    Pass  : demo123');
console.log('    Agenda: http://localhost:5173/book/medicare-plus\n');
console.log('  Login  : http://localhost:5173/login');
console.log('  DB     : ./data/demo.db');
console.log('='.repeat(60));
