const db = require('../db/database');
const { encrypt, decrypt } = require('../lib/crypto');
const { auditLog }         = require('../lib/audit');

const MAX_CONTENT = 10000;

const create = async (req, res) => {
  const { consultation_id, content } = req.body;
  if (!consultation_id || !content) return res.status(400).json({ error: 'consultation_id y content son requeridos' });
  if (typeof content === 'string' && content.length > MAX_CONTENT)
    return res.status(400).json({ error: 'content excede el límite permitido' });

  try {
    const { rows: cRows } = await db.query('SELECT * FROM consultations WHERE id = $1 AND business_id = $2', [consultation_id, req.business.id]);
    if (!cRows[0]) return res.status(404).json({ error: 'Consulta no encontrada' });

    const { rows } = await db.query(
      'INSERT INTO prescriptions (consultation_id, content) VALUES ($1, $2) RETURNING *',
      [consultation_id, encrypt(content)]
    );
    const prescription = rows[0];
    prescription.content = decrypt(prescription.content);
    res.status(201).json(prescription);
  } catch (err) {
    console.error('[prescriptions] create error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const getById = async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT pr.*, c.business_id
      FROM prescriptions pr
      JOIN consultations c ON pr.consultation_id = c.id
      WHERE pr.id = $1 AND c.business_id = $2
    `, [req.params.id, req.business.id]);

    const row = rows[0];
    if (!row) return res.status(404).json({ error: 'Receta no encontrada' });
    await auditLog(req.business.id, 'VIEW_PRESCRIPTION', 'prescription', row.id, req.ip);
    row.content = decrypt(row.content);
    res.json(row);
  } catch (err) {
    console.error('[prescriptions] getById error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const downloadPdf = async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT pr.*, c.business_id, c.patient_id
      FROM prescriptions pr
      JOIN consultations c ON pr.consultation_id = c.id
      WHERE pr.id = $1 AND c.business_id = $2
    `, [req.params.id, req.business.id]);

    const row = rows[0];
    if (!row) return res.status(404).json({ error: 'Receta no encontrada' });
    await auditLog(req.business.id, 'DOWNLOAD_PRESCRIPTION', 'prescription', row.id, req.ip);

    const content = decrypt(row.content);
    const { rows: patientRows } = await db.query('SELECT name, rut FROM patients WHERE id = $1', [row.patient_id]);
    const { rows: bizRows } = await db.query('SELECT name FROM businesses WHERE id = $1', [req.business.id]);
    const patient = patientRows[0];
    const business = bizRows[0];
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

    res.setHeader('Content-Disposition', `attachment; filename="receta-${row.id}.txt"`);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(text);
  } catch (err) {
    console.error('[prescriptions] downloadPdf error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { create, getById, downloadPdf };
