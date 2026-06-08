const db = require('../db/database');
const { encrypt, decrypt } = require('../lib/crypto');

const list = async (req, res) => {
  const { patient_id, date, professional_id } = req.query;
  let where = 'WHERE c.business_id = $1';
  const params = [req.business.id];
  let i = 2;

  if (patient_id) { where += ` AND c.patient_id = $${i++}`; params.push(patient_id); }
  if (professional_id) { where += ` AND c.professional_id = $${i++}`; params.push(professional_id); }
  if (date) { where += ` AND LEFT(c.created_at::text, 10) = $${i++}`; params.push(date); }

  try {
    const { rows } = await db.query(`
      SELECT c.id, c.patient_id, c.booking_id, c.professional_id,
             c.notes, c.diagnosis, c.treatment, c.created_at,
             p.name as patient_name, pr.name as professional_name
      FROM consultations c
      LEFT JOIN patients p ON c.patient_id = p.id
      LEFT JOIN professionals pr ON c.professional_id = pr.id
      ${where}
      ORDER BY c.created_at DESC
    `, params);

    rows.forEach(r => {
      if (r.notes) r.notes = decrypt(r.notes);
      if (r.diagnosis) r.diagnosis = decrypt(r.diagnosis);
      if (r.treatment) r.treatment = decrypt(r.treatment);
    });

    res.json(rows);
  } catch (err) {
    console.error('[consultations] list error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const create = async (req, res) => {
  const { patient_id, booking_id, professional_id, notes, diagnosis, treatment } = req.body;
  if (!patient_id) return res.status(400).json({ error: 'patient_id es requerido' });

  try {
    const { rows: patientRows } = await db.query('SELECT id FROM patients WHERE id = $1 AND business_id = $2', [patient_id, req.business.id]);
    if (!patientRows[0]) return res.status(404).json({ error: 'Paciente no encontrado' });

    if (booking_id) {
      const { rows: bRows } = await db.query('SELECT id FROM bookings WHERE id = $1 AND business_id = $2', [booking_id, req.business.id]);
      if (!bRows[0]) return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    if (professional_id) {
      const { rows: pRows } = await db.query('SELECT id FROM professionals WHERE id = $1 AND business_id = $2', [professional_id, req.business.id]);
      if (!pRows[0]) return res.status(404).json({ error: 'Profesional no encontrado' });
    }

    const { rows } = await db.query(`
      INSERT INTO consultations (business_id, patient_id, booking_id, professional_id, notes, diagnosis, treatment)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      req.business.id, patient_id,
      booking_id || null, professional_id || null,
      notes ? encrypt(notes) : null,
      diagnosis ? encrypt(diagnosis) : null,
      treatment ? encrypt(treatment) : null,
    ]);

    const c = rows[0];
    if (c.notes) c.notes = decrypt(c.notes);
    if (c.diagnosis) c.diagnosis = decrypt(c.diagnosis);
    if (c.treatment) c.treatment = decrypt(c.treatment);

    res.status(201).json(c);
  } catch (err) {
    console.error('[consultations] create error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const getById = async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT c.*, p.name as patient_name, pr.name as professional_name
      FROM consultations c
      LEFT JOIN patients p ON c.patient_id = p.id
      LEFT JOIN professionals pr ON c.professional_id = pr.id
      WHERE c.id = $1 AND c.business_id = $2
    `, [req.params.id, req.business.id]);
    const c = rows[0];
    if (!c) return res.status(404).json({ error: 'Consulta no encontrada' });

    if (c.notes) c.notes = decrypt(c.notes);
    if (c.diagnosis) c.diagnosis = decrypt(c.diagnosis);
    if (c.treatment) c.treatment = decrypt(c.treatment);

    const { rows: prescriptions } = await db.query('SELECT * FROM prescriptions WHERE consultation_id = $1', [c.id]);
    prescriptions.forEach(p => { if (p.content) p.content = decrypt(p.content); });

    res.json({ ...c, prescriptions });
  } catch (err) {
    console.error('[consultations] getById error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const update = async (req, res) => {
  try {
    const { rows: existing } = await db.query('SELECT * FROM consultations WHERE id = $1 AND business_id = $2', [req.params.id, req.business.id]);
    const c = existing[0];
    if (!c) return res.status(404).json({ error: 'Consulta no encontrada' });

    const { notes, diagnosis, treatment } = req.body;
    await db.query('UPDATE consultations SET notes = $1, diagnosis = $2, treatment = $3 WHERE id = $4', [
      notes !== undefined ? (notes ? encrypt(notes) : null) : c.notes,
      diagnosis !== undefined ? (diagnosis ? encrypt(diagnosis) : null) : c.diagnosis,
      treatment !== undefined ? (treatment ? encrypt(treatment) : null) : c.treatment,
      c.id,
    ]);

    const { rows: updated } = await db.query('SELECT * FROM consultations WHERE id = $1', [c.id]);
    const u = updated[0];
    if (u.notes) u.notes = decrypt(u.notes);
    if (u.diagnosis) u.diagnosis = decrypt(u.diagnosis);
    if (u.treatment) u.treatment = decrypt(u.treatment);

    res.json(u);
  } catch (err) {
    console.error('[consultations] update error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { list, create, getById, update };
