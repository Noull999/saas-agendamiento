const pool = require('../db/database');
const { encrypt, decrypt } = require('../lib/crypto');

const list = async (req, res) => {
  try {
    const { patient_id, date, professional_id } = req.query;
    let where = 'WHERE c.business_id = $1';
    const params = [req.business.id];
    let paramCount = 1;

    if (patient_id) { where += ` AND c.patient_id = $${++paramCount}`; params.push(patient_id); }
    if (professional_id) { where += ` AND c.professional_id = $${++paramCount}`; params.push(professional_id); }
    if (date) { where += ` AND DATE(c.created_at AT TIME ZONE 'UTC') = $${++paramCount}`; params.push(date); }

    const result = await pool.query(`
      SELECT c.id, c.patient_id, c.booking_id, c.professional_id,
             c.notes, c.diagnosis, c.treatment, c.created_at,
             p.name as patient_name, pr.name as professional_name
      FROM consultations c
      LEFT JOIN patients p ON c.patient_id = p.id
      LEFT JOIN professionals pr ON c.professional_id = pr.id
      ${where}
      ORDER BY c.created_at DESC
    `, params.slice(0, paramCount));

    result.rows.forEach(r => {
      if (r.notes) r.notes = decrypt(r.notes);
      if (r.diagnosis) r.diagnosis = decrypt(r.diagnosis);
      if (r.treatment) r.treatment = decrypt(r.treatment);
    });

    res.json(result.rows);
  } catch (err) {
    console.error('[consultations] List error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const create = async (req, res) => {
  try {
    const { patient_id, booking_id, professional_id, notes, diagnosis, treatment } = req.body;
    if (!patient_id) return res.status(400).json({ error: 'patient_id es requerido' });

    const patient = await pool.query('SELECT id FROM patients WHERE id = $1 AND business_id = $2', [patient_id, req.business.id]);
    if (patient.rows.length === 0) return res.status(404).json({ error: 'Paciente no encontrado' });

    if (booking_id) {
      const booking = await pool.query('SELECT id FROM bookings WHERE id = $1 AND business_id = $2', [booking_id, req.business.id]);
      if (booking.rows.length === 0) return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    if (professional_id) {
      const prof = await pool.query('SELECT id FROM professionals WHERE id = $1 AND business_id = $2', [professional_id, req.business.id]);
      if (prof.rows.length === 0) return res.status(404).json({ error: 'Profesional no encontrado' });
    }

    const insertResult = await pool.query(`
      INSERT INTO consultations (business_id, patient_id, booking_id, professional_id, notes, diagnosis, treatment, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING id
    `, [
      req.business.id, patient_id,
      booking_id || null, professional_id || null,
      notes ? encrypt(notes) : null,
      diagnosis ? encrypt(diagnosis) : null,
      treatment ? encrypt(treatment) : null
    ]);

    const consultationId = insertResult.rows[0].id;
    const c = await pool.query('SELECT * FROM consultations WHERE id = $1', [consultationId]);
    const consultation = c.rows[0];

    if (consultation.notes) consultation.notes = decrypt(consultation.notes);
    if (consultation.diagnosis) consultation.diagnosis = decrypt(consultation.diagnosis);
    if (consultation.treatment) consultation.treatment = decrypt(consultation.treatment);

    res.status(201).json(consultation);
  } catch (err) {
    console.error('[consultations] Create error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const getById = async (req, res) => {
  try {
    const cResult = await pool.query(`
      SELECT c.*, p.name as patient_name, pr.name as professional_name
      FROM consultations c
      LEFT JOIN patients p ON c.patient_id = p.id
      LEFT JOIN professionals pr ON c.professional_id = pr.id
      WHERE c.id = $1 AND c.business_id = $2
    `, [req.params.id, req.business.id]);

    if (cResult.rows.length === 0) return res.status(404).json({ error: 'Consulta no encontrada' });

    const c = cResult.rows[0];
    if (c.notes) c.notes = decrypt(c.notes);
    if (c.diagnosis) c.diagnosis = decrypt(c.diagnosis);
    if (c.treatment) c.treatment = decrypt(c.treatment);

    const prescriptions = await pool.query('SELECT * FROM prescriptions WHERE consultation_id = $1', [c.id]);
    prescriptions.rows.forEach(p => { if (p.content) p.content = decrypt(p.content); });

    res.json({ ...c, prescriptions: prescriptions.rows });
  } catch (err) {
    console.error('[consultations] GetById error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const update = async (req, res) => {
  try {
    const cResult = await pool.query('SELECT * FROM consultations WHERE id = $1 AND business_id = $2', [req.params.id, req.business.id]);
    if (cResult.rows.length === 0) return res.status(404).json({ error: 'Consulta no encontrada' });

    const c = cResult.rows[0];
    const { notes, diagnosis, treatment } = req.body;

    await pool.query('UPDATE consultations SET notes = $1, diagnosis = $2, treatment = $3, updated_at = NOW() WHERE id = $4', [
      notes !== undefined ? (notes ? encrypt(notes) : null) : c.notes,
      diagnosis !== undefined ? (diagnosis ? encrypt(diagnosis) : null) : c.diagnosis,
      treatment !== undefined ? (treatment ? encrypt(treatment) : null) : c.treatment,
      c.id
    ]);

    const updated = await pool.query('SELECT * FROM consultations WHERE id = $1', [c.id]);
    const consultation = updated.rows[0];
    if (consultation.notes) consultation.notes = decrypt(consultation.notes);
    if (consultation.diagnosis) consultation.diagnosis = decrypt(consultation.diagnosis);
    if (consultation.treatment) consultation.treatment = decrypt(consultation.treatment);

    res.json(consultation);
  } catch (err) {
    console.error('[consultations] Update error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { list, create, getById, update };
