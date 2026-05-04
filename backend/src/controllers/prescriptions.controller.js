const db = require('../db/database');
const { encrypt, decrypt } = require('../lib/crypto');

const create = (req, res) => {
  const { consultation_id, content } = req.body;
  if (!consultation_id || !content) return res.status(400).json({ error: 'consultation_id y content son requeridos' });

  const consultation = db.prepare('SELECT * FROM consultations WHERE id = ? AND business_id = ?').get(consultation_id, req.business.id);
  if (!consultation) return res.status(404).json({ error: 'Consulta no encontrada' });

  const result = db.prepare('INSERT INTO prescriptions (consultation_id, content) VALUES (?, ?)').run(consultation_id, encrypt(content));
  const prescription = db.prepare('SELECT * FROM prescriptions WHERE id = ?').get(result.lastInsertRowid);
  prescription.content = decrypt(prescription.content);
  res.status(201).json(prescription);
};

const getById = (req, res) => {
  const row = db.prepare(`
    SELECT pr.*, c.business_id
    FROM prescriptions pr
    JOIN consultations c ON pr.consultation_id = c.id
    WHERE pr.id = ?
  `).get(req.params.id);

  if (!row || row.business_id !== req.business.id) return res.status(404).json({ error: 'Receta no encontrada' });
  row.content = decrypt(row.content);
  res.json(row);
};

const downloadPdf = (req, res) => {
  const row = db.prepare(`
    SELECT pr.*, c.business_id, c.patient_id
    FROM prescriptions pr
    JOIN consultations c ON pr.consultation_id = c.id
    WHERE pr.id = ?
  `).get(req.params.id);

  if (!row || row.business_id !== req.business.id) return res.status(404).json({ error: 'Receta no encontrada' });

  const content = decrypt(row.content);
  const patient = db.prepare('SELECT name, rut FROM patients WHERE id = ?').get(row.patient_id);
  const business = db.prepare('SELECT name FROM businesses WHERE id = ?').get(req.business.id);
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
};

module.exports = { create, getById, downloadPdf };
