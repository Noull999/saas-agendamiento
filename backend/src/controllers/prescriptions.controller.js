const pool = require('../db/database');
const { encrypt, decrypt } = require('../lib/crypto');
const { auditLog }         = require('../lib/audit');

const MAX_CONTENT = 10000;

const create = async (req, res) => {
  try {
    const { consultation_id, content } = req.body;
    if (!consultation_id || !content) return res.status(400).json({ error: 'consultation_id y content son requeridos' });
    if (typeof content === 'string' && content.length > MAX_CONTENT)
      return res.status(400).json({ error: 'content excede el límite permitido' });

    const consultation = await pool.query('SELECT * FROM consultations WHERE id = $1 AND business_id = $2', [consultation_id, req.business.id]);
    if (consultation.rows.length === 0) return res.status(404).json({ error: 'Consulta no encontrada' });

    const insertResult = await pool.query(
      'INSERT INTO prescriptions (consultation_id, content, created_at, updated_at) VALUES ($1, $2, NOW(), NOW()) RETURNING id',
      [consultation_id, encrypt(content)]
    );

    const prescriptionId = insertResult.rows[0].id;
    const prescription = await pool.query('SELECT * FROM prescriptions WHERE id = $1', [prescriptionId]);
    const result = prescription.rows[0];
    result.content = decrypt(result.content);
    res.status(201).json(result);
  } catch (err) {
    console.error('[prescriptions] Create error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const getById = async (req, res) => {
  try {
    const row = await pool.query(`
      SELECT pr.*, c.business_id
      FROM prescriptions pr
      JOIN consultations c ON pr.consultation_id = c.id
      WHERE pr.id = $1 AND c.business_id = $2
    `, [req.params.id, req.business.id]);

    if (row.rows.length === 0) return res.status(404).json({ error: 'Receta no encontrada' });

    const prescription = row.rows[0];
    auditLog(req.business.id, 'VIEW_PRESCRIPTION', 'prescription', prescription.id, req.ip);
    prescription.content = decrypt(prescription.content);
    res.json(prescription);
  } catch (err) {
    console.error('[prescriptions] GetById error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const downloadPdf = async (req, res) => {
  try {
    const row = await pool.query(`
      SELECT pr.*, c.business_id, c.patient_id
      FROM prescriptions pr
      JOIN consultations c ON pr.consultation_id = c.id
      WHERE pr.id = $1 AND c.business_id = $2
    `, [req.params.id, req.business.id]);

    if (row.rows.length === 0) return res.status(404).json({ error: 'Receta no encontrada' });

    const prescription = row.rows[0];
    auditLog(req.business.id, 'DOWNLOAD_PRESCRIPTION', 'prescription', prescription.id, req.ip);

    const content = decrypt(prescription.content);
    const patientResult = await pool.query('SELECT name, rut FROM patients WHERE id = $1', [prescription.patient_id]);
    const businessResult = await pool.query('SELECT name FROM businesses WHERE id = $1', [req.business.id]);

    const patient = patientResult.rows[0];
    const business = businessResult.rows[0];
    const date = new Date().toLocaleDateString('es-CL');

    const text = [
      'RECETA / INDICACIONES',
      '=====================',
      `Establecimiento: ${business?.name || ''}`,
      `Fecha: ${date}`,
      '',
      `Paciente: ${patient?.name || 'N/A'}`,
      `RUT: ${patient?.rut || 'N/A'}`,
      '',
      'INDICACIONES:',
      '-------------',
      content,
    ].join('\n');

    res.setHeader('Content-Disposition', `attachment; filename="receta-${prescription.id}.txt"`);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(text);
  } catch (err) {
    console.error('[prescriptions] DownloadPdf error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { create, getById, downloadPdf };
