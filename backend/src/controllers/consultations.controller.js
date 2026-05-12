const db = require('../db/database');
const { encrypt, decrypt } = require('../lib/crypto');

const list = (req, res) => {
  const { patient_id, date, professional_id } = req.query;
  let where = 'WHERE c.business_id = ?';
  const params = [req.business.id];

  if (patient_id) { where += ' AND c.patient_id = ?'; params.push(patient_id); }
  if (professional_id) { where += ' AND c.professional_id = ?'; params.push(professional_id); }
  if (date) { where += ' AND date(c.created_at) = ?'; params.push(date); }

  const rows = db.prepare(`
    SELECT c.id, c.patient_id, c.booking_id, c.professional_id,
           c.notes, c.diagnosis, c.treatment, c.created_at,
           p.name as patient_name, pr.name as professional_name
    FROM consultations c
    LEFT JOIN patients p ON c.patient_id = p.id
    LEFT JOIN professionals pr ON c.professional_id = pr.id
    ${where}
    ORDER BY c.created_at DESC
  `).all(...params);

  rows.forEach(r => {
    if (r.notes) r.notes = decrypt(r.notes);
    if (r.diagnosis) r.diagnosis = decrypt(r.diagnosis);
    if (r.treatment) r.treatment = decrypt(r.treatment);
  });

  res.json(rows);
};

const create = (req, res) => {
  const { patient_id, booking_id, professional_id, notes, diagnosis, treatment } = req.body;
  if (!patient_id) return res.status(400).json({ error: 'patient_id es requerido' });

  const patient = db.prepare('SELECT id FROM patients WHERE id = ? AND business_id = ?').get(patient_id, req.business.id);
  if (!patient) return res.status(404).json({ error: 'Paciente no encontrado' });

  if (booking_id) {
    const booking = db.prepare('SELECT id FROM bookings WHERE id = ? AND business_id = ?').get(booking_id, req.business.id);
    if (!booking) return res.status(404).json({ error: 'Reserva no encontrada' });
  }

  if (professional_id) {
    const prof = db.prepare('SELECT id FROM professionals WHERE id = ? AND business_id = ?').get(professional_id, req.business.id);
    if (!prof) return res.status(404).json({ error: 'Profesional no encontrado' });
  }

  const result = db.prepare(`
    INSERT INTO consultations (business_id, patient_id, booking_id, professional_id, notes, diagnosis, treatment)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.business.id, patient_id,
    booking_id || null, professional_id || null,
    notes ? encrypt(notes) : null,
    diagnosis ? encrypt(diagnosis) : null,
    treatment ? encrypt(treatment) : null
  );

  const c = db.prepare('SELECT * FROM consultations WHERE id = ?').get(result.lastInsertRowid);
  if (c.notes) c.notes = decrypt(c.notes);
  if (c.diagnosis) c.diagnosis = decrypt(c.diagnosis);
  if (c.treatment) c.treatment = decrypt(c.treatment);

  res.status(201).json(c);
};

const getById = (req, res) => {
  const c = db.prepare(`
    SELECT c.*, p.name as patient_name, pr.name as professional_name
    FROM consultations c
    LEFT JOIN patients p ON c.patient_id = p.id
    LEFT JOIN professionals pr ON c.professional_id = pr.id
    WHERE c.id = ? AND c.business_id = ?
  `).get(req.params.id, req.business.id);
  if (!c) return res.status(404).json({ error: 'Consulta no encontrada' });

  if (c.notes) c.notes = decrypt(c.notes);
  if (c.diagnosis) c.diagnosis = decrypt(c.diagnosis);
  if (c.treatment) c.treatment = decrypt(c.treatment);

  const prescriptions = db.prepare('SELECT * FROM prescriptions WHERE consultation_id = ?').all(c.id);
  prescriptions.forEach(p => { if (p.content) p.content = decrypt(p.content); });

  res.json({ ...c, prescriptions });
};

const update = (req, res) => {
  const c = db.prepare('SELECT * FROM consultations WHERE id = ? AND business_id = ?').get(req.params.id, req.business.id);
  if (!c) return res.status(404).json({ error: 'Consulta no encontrada' });

  const { notes, diagnosis, treatment } = req.body;

  db.prepare('UPDATE consultations SET notes = ?, diagnosis = ?, treatment = ? WHERE id = ?').run(
    notes !== undefined ? (notes ? encrypt(notes) : null) : c.notes,
    diagnosis !== undefined ? (diagnosis ? encrypt(diagnosis) : null) : c.diagnosis,
    treatment !== undefined ? (treatment ? encrypt(treatment) : null) : c.treatment,
    c.id
  );

  const updated = db.prepare('SELECT * FROM consultations WHERE id = ?').get(c.id);
  if (updated.notes) updated.notes = decrypt(updated.notes);
  if (updated.diagnosis) updated.diagnosis = decrypt(updated.diagnosis);
  if (updated.treatment) updated.treatment = decrypt(updated.treatment);

  res.json(updated);
};

module.exports = { list, create, getById, update };
