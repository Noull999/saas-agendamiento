const db = require('../db/database');
const { encrypt, decrypt } = require('../lib/crypto');
const { isValidRut }       = require('../lib/rut');
const { auditLog }         = require('../lib/audit');

const list = async (req, res) => {
  const { search, page = '1', limit = '20' } = req.query;
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const offset = (pageNum - 1) * limitNum;

  let whereClause = 'WHERE p.business_id = $1';
  const params = [req.business.id];
  let i = 2;

  if (search) {
    whereClause += ` AND (LOWER(p.name) LIKE $${i++} OR LOWER(p.rut) LIKE $${i++})`;
    const s = `%${search.toLowerCase()}%`;
    params.push(s, s);
  }

  try {
    const { rows: totalRows } = await db.query(`SELECT COUNT(*) as total FROM patients p ${whereClause}`, params);
    const total = parseInt(totalRows[0].total);

    const { rows: patients } = await db.query(`
      SELECT p.id, p.rut, p.name, p.birth_date, p.phone, p.email, p.notes, p.created_at,
             COUNT(b.id) as booking_count,
             MAX(b.datetime_iso) as last_booking_at
      FROM patients p
      LEFT JOIN bookings b ON b.patient_id = p.id AND b.status != 'cancelled'
      ${whereClause}
      GROUP BY p.id
      ORDER BY p.name ASC LIMIT $${i++} OFFSET $${i++}
    `, [...params, limitNum, offset]);

    res.json({ patients, total, page: pageNum, pages: Math.ceil(total / limitNum) });
  } catch (err) {
    console.error('[patients] list error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const getById = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM patients WHERE id = $1 AND business_id = $2', [req.params.id, req.business.id]);
    const patient = rows[0];
    if (!patient) return res.status(404).json({ error: 'Paciente no encontrado' });
    await auditLog(req.business.id, 'VIEW_PATIENT', 'patient', patient.id, req.ip);

    if (patient.allergies) patient.allergies = decrypt(patient.allergies);
    if (patient.background) patient.background = decrypt(patient.background);

    const { rows: consultations } = await db.query(`
      SELECT c.id, c.created_at, c.diagnosis, pr.name as professional_name
      FROM consultations c
      LEFT JOIN professionals pr ON c.professional_id = pr.id
      WHERE c.patient_id = $1 AND c.business_id = $2
      ORDER BY c.created_at DESC LIMIT 5
    `, [patient.id, req.business.id]);

    consultations.forEach(c => { if (c.diagnosis) c.diagnosis = decrypt(c.diagnosis); });

    res.json({ ...patient, recent_consultations: consultations });
  } catch (err) {
    console.error('[patients] getById error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const MAX_TEXT = 5000;

const create = async (req, res) => {
  const { rut, name, birth_date, phone, email, allergies, background, notes } = req.body;

  if (!name) return res.status(400).json({ error: 'name es requerido' });
  if (allergies && typeof allergies === 'string' && allergies.length > MAX_TEXT)
    return res.status(400).json({ error: 'allergies excede el límite permitido' });
  if (background && typeof background === 'string' && background.length > MAX_TEXT)
    return res.status(400).json({ error: 'background excede el límite permitido' });

  try {
    const { rows: bizRows } = await db.query('SELECT vertical FROM businesses WHERE id = $1', [req.business.id]);
    const isBelleza = (bizRows[0]?.vertical || 'salud') === 'belleza';

    let safeRut;
    if (isBelleza) {
      safeRut = `CLI-${req.business.id}-${Date.now()}`;
    } else {
      if (!rut) return res.status(400).json({ error: 'rut y name son requeridos' });
      if (!isValidRut(rut)) return res.status(400).json({ error: 'RUT inválido' });
      const { rows: existing } = await db.query('SELECT id FROM patients WHERE business_id = $1 AND rut = $2', [req.business.id, rut]);
      if (existing[0]) return res.status(409).json({ error: 'Paciente ya registrado', patient_id: existing[0].id });
      safeRut = rut;
    }

    const { rows } = await db.query(`
      INSERT INTO patients (business_id, rut, name, birth_date, phone, email, allergies, background, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, rut, name, birth_date, phone, email, notes, created_at
    `, [
      req.business.id, safeRut, name.trim(),
      birth_date || null, phone || null, email || null,
      allergies ? encrypt(allergies) : null,
      background ? encrypt(background) : null,
      notes || null,
    ]);

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[patients] create error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const update = async (req, res) => {
  try {
    const { rows: existing } = await db.query('SELECT * FROM patients WHERE id = $1 AND business_id = $2', [req.params.id, req.business.id]);
    const patient = existing[0];
    if (!patient) return res.status(404).json({ error: 'Paciente no encontrado' });

    const { name, birth_date, phone, email, allergies, background, notes } = req.body;
    if (allergies && typeof allergies === 'string' && allergies.length > MAX_TEXT)
      return res.status(400).json({ error: 'allergies excede el límite permitido' });
    if (background && typeof background === 'string' && background.length > MAX_TEXT)
      return res.status(400).json({ error: 'background excede el límite permitido' });

    await db.query(`
      UPDATE patients SET name = $1, birth_date = $2, phone = $3, email = $4, allergies = $5, background = $6, notes = $7
      WHERE id = $8
    `, [
      name !== undefined ? name.trim() : patient.name,
      birth_date !== undefined ? birth_date : patient.birth_date,
      phone !== undefined ? phone : patient.phone,
      email !== undefined ? email : patient.email,
      allergies !== undefined ? (allergies ? encrypt(allergies) : null) : patient.allergies,
      background !== undefined ? (background ? encrypt(background) : null) : patient.background,
      notes !== undefined ? notes : patient.notes,
      patient.id,
    ]);

    const { rows: updated } = await db.query(
      'SELECT id, rut, name, birth_date, phone, email, notes, created_at FROM patients WHERE id = $1',
      [patient.id]
    );
    res.json(updated[0]);
  } catch (err) {
    console.error('[patients] update error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const history = async (req, res) => {
  const { page = '1', limit = '10' } = req.query;
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 10));
  const offset = (pageNum - 1) * limitNum;

  try {
    const { rows: patientRows } = await db.query('SELECT id FROM patients WHERE id = $1 AND business_id = $2', [req.params.id, req.business.id]);
    if (!patientRows[0]) return res.status(404).json({ error: 'Paciente no encontrado' });
    const patient = patientRows[0];

    const { rows: totalRows } = await db.query(
      'SELECT COUNT(*) as total FROM consultations WHERE patient_id = $1 AND business_id = $2',
      [patient.id, req.business.id]
    );
    const total = parseInt(totalRows[0].total);

    const { rows } = await db.query(`
      SELECT c.id, c.created_at, c.diagnosis, c.treatment, pr.name as professional_name
      FROM consultations c
      LEFT JOIN professionals pr ON c.professional_id = pr.id
      WHERE c.patient_id = $1 AND c.business_id = $2
      ORDER BY c.created_at DESC LIMIT $3 OFFSET $4
    `, [patient.id, req.business.id, limitNum, offset]);

    rows.forEach(r => {
      if (r.diagnosis) r.diagnosis = decrypt(r.diagnosis);
      if (r.treatment) r.treatment = decrypt(r.treatment);
    });

    res.json({ consultations: rows, total, page: pageNum, pages: Math.ceil(total / limitNum) });
  } catch (err) {
    console.error('[patients] history error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const exportData = async (req, res) => {
  try {
    const { rows: patientRows } = await db.query('SELECT * FROM patients WHERE id = $1 AND business_id = $2', [req.params.id, req.business.id]);
    const patient = patientRows[0];
    if (!patient) return res.status(404).json({ error: 'Paciente no encontrado' });
    await auditLog(req.business.id, 'EXPORT_PATIENT', 'patient', patient.id, req.ip);

    if (patient.allergies) patient.allergies = decrypt(patient.allergies);
    if (patient.background) patient.background = decrypt(patient.background);

    const { rows: consultations } = await db.query(`
      SELECT c.*, pr.name as professional_name
      FROM consultations c
      LEFT JOIN professionals pr ON c.professional_id = pr.id
      WHERE c.patient_id = $1 AND c.business_id = $2
      ORDER BY c.created_at DESC
    `, [patient.id, req.business.id]);

    for (const c of consultations) {
      if (c.notes) c.notes = decrypt(c.notes);
      if (c.diagnosis) c.diagnosis = decrypt(c.diagnosis);
      if (c.treatment) c.treatment = decrypt(c.treatment);
      const { rows: prescriptions } = await db.query('SELECT * FROM prescriptions WHERE consultation_id = $1', [c.id]);
      c.prescriptions = prescriptions;
      c.prescriptions.forEach(p => { if (p.content) p.content = decrypt(p.content); });
    }

    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Disposition', `attachment; filename="paciente-${patient.rut}-${date}.json"`);
    res.json({ patient, consultations });
  } catch (err) {
    console.error('[patients] exportData error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const clientBookings = async (req, res) => {
  try {
    const { rows: patientRows } = await db.query('SELECT id FROM patients WHERE id = $1 AND business_id = $2', [req.params.id, req.business.id]);
    if (!patientRows[0]) return res.status(404).json({ error: 'Cliente no encontrado' });
    const patient = patientRows[0];

    const { rows: bookings } = await db.query(`
      SELECT b.id, b.datetime_iso, b.status, b.notes, b.client_name,
             s.name as service_name, pr.name as professional_name
      FROM bookings b
      LEFT JOIN services s ON b.service_id = s.id
      LEFT JOIN professionals pr ON b.professional_id = pr.id
      WHERE b.patient_id = $1 AND b.business_id = $2
      ORDER BY b.datetime_iso DESC LIMIT 30
    `, [patient.id, req.business.id]);

    res.json({ bookings });
  } catch (err) {
    console.error('[patients] clientBookings error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { list, getById, create, update, history, exportData, clientBookings };
