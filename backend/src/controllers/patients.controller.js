const db = require('../db/database');
const { encrypt, decrypt } = require('../lib/crypto');
const { isValidRut }       = require('../lib/rut');

const list = (req, res) => {
  const { search, page = '1', limit = '20' } = req.query;
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const offset = (pageNum - 1) * limitNum;

  let where = 'WHERE business_id = ?';
  const params = [req.business.id];

  if (search) {
    where += ' AND (LOWER(name) LIKE ? OR LOWER(rut) LIKE ?)';
    const s = `%${search.toLowerCase()}%`;
    params.push(s, s);
  }

  const { total } = db.prepare(`SELECT COUNT(*) as total FROM patients ${where}`).get(...params);
  const patients = db.prepare(
    `SELECT id, rut, name, birth_date, phone, email, created_at FROM patients ${where} ORDER BY name ASC LIMIT ? OFFSET ?`
  ).all(...params, limitNum, offset);

  res.json({ patients, total, page: pageNum, pages: Math.ceil(total / limitNum) });
};

const getById = (req, res) => {
  const patient = db.prepare('SELECT * FROM patients WHERE id = ? AND business_id = ?').get(req.params.id, req.business.id);
  if (!patient) return res.status(404).json({ error: 'Paciente no encontrado' });

  if (patient.allergies) patient.allergies = decrypt(patient.allergies);
  if (patient.background) patient.background = decrypt(patient.background);

  const consultations = db.prepare(`
    SELECT c.id, c.created_at, c.diagnosis, pr.name as professional_name
    FROM consultations c
    LEFT JOIN professionals pr ON c.professional_id = pr.id
    WHERE c.patient_id = ? AND c.business_id = ?
    ORDER BY c.created_at DESC LIMIT 5
  `).all(patient.id, req.business.id);

  consultations.forEach(c => { if (c.diagnosis) c.diagnosis = decrypt(c.diagnosis); });

  res.json({ ...patient, recent_consultations: consultations });
};

const create = (req, res) => {
  const { rut, name, birth_date, phone, email, allergies, background } = req.body;
  if (!rut || !name) return res.status(400).json({ error: 'rut y name son requeridos' });
  if (!isValidRut(rut)) return res.status(400).json({ error: 'RUT inválido' });

  const existing = db.prepare('SELECT id FROM patients WHERE business_id = ? AND rut = ?').get(req.business.id, rut);
  if (existing) return res.status(409).json({ error: 'Paciente ya registrado', patient_id: existing.id });

  const result = db.prepare(`
    INSERT INTO patients (business_id, rut, name, birth_date, phone, email, allergies, background)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.business.id, rut, name.trim(),
    birth_date || null, phone || null, email || null,
    allergies ? encrypt(allergies) : null,
    background ? encrypt(background) : null
  );

  const patient = db.prepare('SELECT id, rut, name, birth_date, phone, email, created_at FROM patients WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(patient);
};

const update = (req, res) => {
  const patient = db.prepare('SELECT * FROM patients WHERE id = ? AND business_id = ?').get(req.params.id, req.business.id);
  if (!patient) return res.status(404).json({ error: 'Paciente no encontrado' });

  const { name, birth_date, phone, email, allergies, background } = req.body;

  db.prepare(`
    UPDATE patients SET name = ?, birth_date = ?, phone = ?, email = ?, allergies = ?, background = ?
    WHERE id = ?
  `).run(
    name !== undefined ? name.trim() : patient.name,
    birth_date !== undefined ? birth_date : patient.birth_date,
    phone !== undefined ? phone : patient.phone,
    email !== undefined ? email : patient.email,
    allergies !== undefined ? (allergies ? encrypt(allergies) : null) : patient.allergies,
    background !== undefined ? (background ? encrypt(background) : null) : patient.background,
    patient.id
  );

  res.json(db.prepare('SELECT id, rut, name, birth_date, phone, email, created_at FROM patients WHERE id = ?').get(patient.id));
};

const history = (req, res) => {
  const { page = '1', limit = '10' } = req.query;
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 10));
  const offset = (pageNum - 1) * limitNum;

  const patient = db.prepare('SELECT id FROM patients WHERE id = ? AND business_id = ?').get(req.params.id, req.business.id);
  if (!patient) return res.status(404).json({ error: 'Paciente no encontrado' });

  const { total } = db.prepare('SELECT COUNT(*) as total FROM consultations WHERE patient_id = ? AND business_id = ?').get(patient.id, req.business.id);

  const rows = db.prepare(`
    SELECT c.id, c.created_at, c.diagnosis, c.treatment, pr.name as professional_name
    FROM consultations c
    LEFT JOIN professionals pr ON c.professional_id = pr.id
    WHERE c.patient_id = ? AND c.business_id = ?
    ORDER BY c.created_at DESC LIMIT ? OFFSET ?
  `).all(patient.id, req.business.id, limitNum, offset);

  rows.forEach(r => {
    if (r.diagnosis) r.diagnosis = decrypt(r.diagnosis);
    if (r.treatment) r.treatment = decrypt(r.treatment);
  });

  res.json({ consultations: rows, total, page: pageNum, pages: Math.ceil(total / limitNum) });
};

const exportData = (req, res) => {
  const patient = db.prepare('SELECT * FROM patients WHERE id = ? AND business_id = ?').get(req.params.id, req.business.id);
  if (!patient) return res.status(404).json({ error: 'Paciente no encontrado' });

  if (patient.allergies) patient.allergies = decrypt(patient.allergies);
  if (patient.background) patient.background = decrypt(patient.background);

  const consultations = db.prepare(`
    SELECT c.*, pr.name as professional_name
    FROM consultations c
    LEFT JOIN professionals pr ON c.professional_id = pr.id
    WHERE c.patient_id = ? AND c.business_id = ?
    ORDER BY c.created_at DESC
  `).all(patient.id, req.business.id);

  consultations.forEach(c => {
    if (c.notes) c.notes = decrypt(c.notes);
    if (c.diagnosis) c.diagnosis = decrypt(c.diagnosis);
    if (c.treatment) c.treatment = decrypt(c.treatment);
    c.prescriptions = db.prepare('SELECT * FROM prescriptions WHERE consultation_id = ?').all(c.id);
    c.prescriptions.forEach(p => { if (p.content) p.content = decrypt(p.content); });
  });

  const date = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Disposition', `attachment; filename="paciente-${patient.rut}-${date}.json"`);
  res.json({ patient, consultations });
};

module.exports = { list, getById, create, update, history, exportData };
