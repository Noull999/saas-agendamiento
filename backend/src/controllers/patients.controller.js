const pool = require('../db/database');
const { encrypt, decrypt } = require('../lib/crypto');
const { isValidRut }       = require('../lib/rut');
const { auditLog }         = require('../lib/audit');

const list = async (req, res) => {
  const { search, page = '1', limit = '20' } = req.query;
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const offset = (pageNum - 1) * limitNum;

  try {
    let whereClause = 'WHERE p.business_id = $1';
    const params = [req.business.id];
    let paramCount = 1;

    if (search) {
      whereClause += ` AND (LOWER(p.name) LIKE $${++paramCount} OR LOWER(p.rut) LIKE $${paramCount})`;
      const s = `%${search.toLowerCase()}%`;
      params.push(s, s);
    }

    const countResult = await pool.query(`SELECT COUNT(*) as total FROM patients p ${whereClause}`, params.slice(0, paramCount));
    const total = parseInt(countResult.rows[0].total);

    params.push(limitNum, offset);
    const patientsResult = await pool.query(`
      SELECT p.id, p.rut, p.name, p.birth_date, p.phone, p.email, p.notes, p.created_at,
             COUNT(b.id) as booking_count,
             MAX(b.datetime_iso) as last_booking_at
      FROM patients p
      LEFT JOIN bookings b ON b.patient_id = p.id AND b.status != 'cancelled'
      ${whereClause}
      GROUP BY p.id
      ORDER BY p.name ASC LIMIT $${paramCount + 2} OFFSET $${paramCount + 3}
    `, params);

    res.json({ patients: patientsResult.rows, total, page: pageNum, pages: Math.ceil(total / limitNum) });
  } catch (err) {
    console.error('[patients] List error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const getById = async (req, res) => {
  try {
    const patientResult = await pool.query('SELECT * FROM patients WHERE id = $1 AND business_id = $2', [req.params.id, req.business.id]);
    if (patientResult.rows.length === 0) return res.status(404).json({ error: 'Paciente no encontrado' });

    const patient = patientResult.rows[0];
    auditLog(req.business.id, 'VIEW_PATIENT', 'patient', patient.id, req.ip);

    if (patient.allergies) patient.allergies = decrypt(patient.allergies);
    if (patient.background) patient.background = decrypt(patient.background);

    const consultationsResult = await pool.query(`
      SELECT c.id, c.created_at, c.diagnosis, pr.name as professional_name
      FROM consultations c
      LEFT JOIN professionals pr ON c.professional_id = pr.id
      WHERE c.patient_id = $1 AND c.business_id = $2
      ORDER BY c.created_at DESC LIMIT 5
    `, [patient.id, req.business.id]);

    consultationsResult.rows.forEach(c => { if (c.diagnosis) c.diagnosis = decrypt(c.diagnosis); });

    res.json({ ...patient, recent_consultations: consultationsResult.rows });
  } catch (err) {
    console.error('[patients] GetById error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const MAX_TEXT = 5000;

const create = async (req, res) => {
  try {
    const { rut, name, birth_date, phone, email, allergies, background, notes } = req.body;

    const bizResult = await pool.query('SELECT vertical FROM businesses WHERE id = $1', [req.business.id]);
    const isBelleza = (bizResult.rows[0]?.vertical || 'salud') === 'belleza';

    if (!name) return res.status(400).json({ error: 'name es requerido' });
    if (allergies && typeof allergies === 'string' && allergies.length > MAX_TEXT)
      return res.status(400).json({ error: 'allergies excede el límite permitido' });
    if (background && typeof background === 'string' && background.length > MAX_TEXT)
      return res.status(400).json({ error: 'background excede el límite permitido' });

    let safeRut;
    if (isBelleza) {
      safeRut = `CLI-${req.business.id}-${Date.now()}`;
    } else {
      if (!rut) return res.status(400).json({ error: 'rut y name son requeridos' });
      if (!isValidRut(rut)) return res.status(400).json({ error: 'RUT inválido' });
      const existing = await pool.query('SELECT id FROM patients WHERE business_id = $1 AND rut = $2', [req.business.id, rut]);
      if (existing.rows.length > 0) return res.status(409).json({ error: 'Paciente ya registrado', patient_id: existing.rows[0].id });
      safeRut = rut;
    }

    const insertResult = await pool.query(`
      INSERT INTO patients (business_id, rut, name, birth_date, phone, email, allergies, background, notes, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING id
    `, [
      req.business.id, safeRut, name.trim(),
      birth_date || null, phone || null, email || null,
      allergies ? encrypt(allergies) : null,
      background ? encrypt(background) : null,
      notes || null
    ]);

    const patientId = insertResult.rows[0].id;
    const patientResult = await pool.query('SELECT id, rut, name, birth_date, phone, email, notes, created_at FROM patients WHERE id = $1', [patientId]);
    res.status(201).json(patientResult.rows[0]);
  } catch (err) {
    console.error('[patients] Create error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const update = async (req, res) => {
  try {
    const patientResult = await pool.query('SELECT * FROM patients WHERE id = $1 AND business_id = $2', [req.params.id, req.business.id]);
    if (patientResult.rows.length === 0) return res.status(404).json({ error: 'Paciente no encontrado' });

    const patient = patientResult.rows[0];
    const { name, birth_date, phone, email, allergies, background, notes } = req.body;

    if (allergies && typeof allergies === 'string' && allergies.length > MAX_TEXT)
      return res.status(400).json({ error: 'allergies excede el límite permitido' });
    if (background && typeof background === 'string' && background.length > MAX_TEXT)
      return res.status(400).json({ error: 'background excede el límite permitido' });

    await pool.query(`
      UPDATE patients SET
        name = $1, birth_date = $2, phone = $3, email = $4, allergies = $5, background = $6, notes = $7, updated_at = NOW()
      WHERE id = $8
    `, [
      name !== undefined ? name.trim() : patient.name,
      birth_date !== undefined ? birth_date : patient.birth_date,
      phone !== undefined ? phone : patient.phone,
      email !== undefined ? email : patient.email,
      allergies !== undefined ? (allergies ? encrypt(allergies) : null) : patient.allergies,
      background !== undefined ? (background ? encrypt(background) : null) : patient.background,
      notes !== undefined ? notes : patient.notes,
      patient.id
    ]);

    const result = await pool.query('SELECT id, rut, name, birth_date, phone, email, notes, created_at FROM patients WHERE id = $1', [patient.id]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[patients] Update error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const history = async (req, res) => {
  try {
    const { page = '1', limit = '10' } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 10));
    const offset = (pageNum - 1) * limitNum;

    const patientResult = await pool.query('SELECT id FROM patients WHERE id = $1 AND business_id = $2', [req.params.id, req.business.id]);
    if (patientResult.rows.length === 0) return res.status(404).json({ error: 'Paciente no encontrado' });

    const patient = patientResult.rows[0];
    const countResult = await pool.query('SELECT COUNT(*) as total FROM consultations WHERE patient_id = $1 AND business_id = $2', [patient.id, req.business.id]);
    const total = parseInt(countResult.rows[0].total);

    const rowsResult = await pool.query(`
      SELECT c.id, c.created_at, c.diagnosis, c.treatment, pr.name as professional_name
      FROM consultations c
      LEFT JOIN professionals pr ON c.professional_id = pr.id
      WHERE c.patient_id = $1 AND c.business_id = $2
      ORDER BY c.created_at DESC LIMIT $3 OFFSET $4
    `, [patient.id, req.business.id, limitNum, offset]);

    rowsResult.rows.forEach(r => {
      if (r.diagnosis) r.diagnosis = decrypt(r.diagnosis);
      if (r.treatment) r.treatment = decrypt(r.treatment);
    });

    res.json({ consultations: rowsResult.rows, total, page: pageNum, pages: Math.ceil(total / limitNum) });
  } catch (err) {
    console.error('[patients] History error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const exportData = async (req, res) => {
  try {
    const patientResult = await pool.query('SELECT * FROM patients WHERE id = $1 AND business_id = $2', [req.params.id, req.business.id]);
    if (patientResult.rows.length === 0) return res.status(404).json({ error: 'Paciente no encontrado' });

    const patient = patientResult.rows[0];
    auditLog(req.business.id, 'EXPORT_PATIENT', 'patient', patient.id, req.ip);

    if (patient.allergies) patient.allergies = decrypt(patient.allergies);
    if (patient.background) patient.background = decrypt(patient.background);

    const consultationsResult = await pool.query(`
      SELECT c.*, pr.name as professional_name
      FROM consultations c
      LEFT JOIN professionals pr ON c.professional_id = pr.id
      WHERE c.patient_id = $1 AND c.business_id = $2
      ORDER BY c.created_at DESC
    `, [patient.id, req.business.id]);

    for (const c of consultationsResult.rows) {
      if (c.notes) c.notes = decrypt(c.notes);
      if (c.diagnosis) c.diagnosis = decrypt(c.diagnosis);
      if (c.treatment) c.treatment = decrypt(c.treatment);
      const prescResult = await pool.query('SELECT * FROM prescriptions WHERE consultation_id = $1', [c.id]);
      c.prescriptions = prescResult.rows;
      c.prescriptions.forEach(p => { if (p.content) p.content = decrypt(p.content); });
    }

    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Disposition', `attachment; filename="paciente-${patient.rut}-${date}.json"`);
    res.json({ patient, consultations: consultationsResult.rows });
  } catch (err) {
    console.error('[patients] ExportData error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const clientBookings = async (req, res) => {
  try {
    const patientResult = await pool.query('SELECT id FROM patients WHERE id = $1 AND business_id = $2', [req.params.id, req.business.id]);
    if (patientResult.rows.length === 0) return res.status(404).json({ error: 'Cliente no encontrado' });

    const patient = patientResult.rows[0];
    const bookingsResult = await pool.query(`
      SELECT b.id, b.datetime_iso, b.status, b.notes, b.client_name,
             s.name as service_name, pr.name as professional_name
      FROM bookings b
      LEFT JOIN services s ON b.service_id = s.id
      LEFT JOIN professionals pr ON b.professional_id = pr.id
      WHERE b.patient_id = $1 AND b.business_id = $2
      ORDER BY b.datetime_iso DESC LIMIT 30
    `, [patient.id, req.business.id]);

    res.json({ bookings: bookingsResult.rows });
  } catch (err) {
    console.error('[patients] ClientBookings error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { list, getById, create, update, history, exportData, clientBookings };
