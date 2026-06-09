const PDFDocument = require('pdfkit');
const db = require('../db/database');

const bookingsReport = async (req, res) => {
  const { from, to } = req.query;
  const fromDate = from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const toDate = to || new Date().toISOString().slice(0, 10);

  try {
    const { rows: biz } = await db.query('SELECT * FROM businesses WHERE id = $1', [req.business.id]);
    const business = biz[0];

    const { rows: bookings } = await db.query(`
      SELECT b.*, s.name as service_name
      FROM bookings b
      LEFT JOIN services s ON b.service_id = s.id
      WHERE b.business_id = $1
        AND LEFT(b.datetime_iso, 10) >= $2
        AND LEFT(b.datetime_iso, 10) <= $3
        AND b.status != 'cancelled'
      ORDER BY b.datetime_iso ASC
    `, [req.business.id, fromDate, toDate]);

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="reservas-${fromDate}-${toDate}.pdf"`);
    doc.pipe(res);

    // Header
    doc.fontSize(20).font('Helvetica-Bold').fillColor('#000').text(business.name || 'Mi Negocio', { align: 'left' });
    doc.fontSize(10).font('Helvetica').fillColor('#666666').text(`Reporte de reservas: ${fromDate} al ${toDate}`, { align: 'left' });
    doc.moveDown();

    // Summary
    const total = bookings.length;
    const completed = bookings.filter(b => b.status === 'completed').length;
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#000000').text('Resumen');
    doc.fontSize(10).font('Helvetica').fillColor('#000000').text(`Total reservas: ${total}`);
    doc.text(`Completadas: ${completed}`);
    doc.text(`Tasa asistencia: ${total > 0 ? Math.round(completed / total * 100) : 0}%`);
    doc.moveDown();

    // Table
    doc.fontSize(12).font('Helvetica-Bold').text('Detalle de Reservas');
    doc.moveDown(0.5);

    const colX = [50, 160, 280, 370, 460];
    const headers = ['Fecha/Hora', 'Cliente', 'Servicio', 'Telefono', 'Estado'];

    // Table header row
    const headerY = doc.y;
    doc.rect(50, headerY, 495, 18).fill('#333333');
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#ffffff');
    headers.forEach((h, i) => {
      doc.text(h, colX[i], headerY + 4, { width: 105, lineBreak: false });
    });
    doc.fillColor('#000000').y = headerY + 22;
    doc.moveDown(0.2);

    // Table rows
    bookings.forEach((b, idx) => {
      if (doc.y > 720) { doc.addPage(); }
      const y = doc.y;
      if (idx % 2 === 0) {
        doc.rect(50, y, 495, 15).fill('#f5f5f5');
      }
      const dateStr = b.datetime_iso
        ? new Date(b.datetime_iso).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })
        : '—';
      const row = [
        dateStr,
        (b.client_name || '—').slice(0, 20),
        (b.service_name || '—').slice(0, 20),
        (b.client_phone || '—').slice(0, 15),
        b.status || '—',
      ];
      doc.fontSize(8).font('Helvetica').fillColor('#000000');
      row.forEach((val, i) => {
        doc.text(val, colX[i], y + 3, { width: 105, lineBreak: false });
      });
      doc.y = y + 17;
    });

    doc.end();
  } catch (err) {
    console.error('[reports] bookingsReport error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Error generando PDF' });
  }
};

const patientReport = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows: patients } = await db.query(
      'SELECT * FROM patients WHERE id = $1 AND business_id = $2',
      [id, req.business.id]
    );
    if (!patients[0]) return res.status(404).json({ error: 'Paciente no encontrado' });
    const patient = patients[0];

    const { rows: bookings } = await db.query(`
      SELECT b.*, s.name as service_name
      FROM bookings b
      LEFT JOIN services s ON b.service_id = s.id
      WHERE b.patient_id = $1
      ORDER BY b.datetime_iso DESC
    `, [id]);

    const { rows: consultations } = await db.query(`
      SELECT c.*, pr.name as professional_name
      FROM consultations c
      LEFT JOIN professionals pr ON c.professional_id = pr.id
      WHERE c.patient_id = $1
      ORDER BY c.created_at DESC
    `, [id]);

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="paciente-${patient.rut}.pdf"`);
    doc.pipe(res);

    // Header
    doc.fontSize(18).font('Helvetica-Bold').fillColor('#000000').text('Historial Clinico del Paciente');
    doc.fontSize(10).font('Helvetica').fillColor('#666666').text(`Generado el ${new Date().toLocaleDateString('es-CL')}`);
    doc.moveDown();

    // Patient data
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#000000').text('Datos del Paciente');
    doc.fontSize(10).font('Helvetica').fillColor('#000000');
    doc.text(`Nombre: ${patient.name || '—'}`);
    doc.text(`RUT: ${patient.rut || '—'}`);
    if (patient.phone) doc.text(`Telefono: ${patient.phone}`);
    if (patient.email) doc.text(`Email: ${patient.email}`);
    if (patient.birth_date) doc.text(`Fecha de nacimiento: ${patient.birth_date}`);
    if (patient.allergies) doc.text(`Alergias: ${patient.allergies}`);
    if (patient.background) doc.text(`Antecedentes: ${patient.background}`);
    doc.moveDown();

    // Consultations
    if (consultations.length > 0) {
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#000000').text('Consultas');
      consultations.forEach(c => {
        doc.moveDown(0.3);
        const dateStr = c.created_at ? new Date(c.created_at).toLocaleDateString('es-CL') : '—';
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000').text(dateStr);
        if (c.professional_name) doc.fontSize(8).font('Helvetica').fillColor('#333333').text(`Profesional: ${c.professional_name}`);
        if (c.diagnosis) doc.fontSize(8).font('Helvetica').fillColor('#000000').text(`Diagnostico: ${c.diagnosis}`);
        if (c.treatment) doc.fontSize(8).font('Helvetica').fillColor('#000000').text(`Tratamiento: ${c.treatment}`);
        if (c.notes) doc.fontSize(8).font('Helvetica').fillColor('#555555').text(`Notas: ${c.notes}`);
      });
      doc.moveDown();
    }

    // Bookings
    if (bookings.length > 0) {
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#000000').text('Reservas');
      doc.moveDown(0.3);
      bookings.slice(0, 20).forEach(b => {
        const date = b.datetime_iso
          ? new Date(b.datetime_iso).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })
          : '—';
        doc.fontSize(9).font('Helvetica').fillColor('#000000')
          .text(`${date}  —  ${b.service_name || 'Sin servicio'}  —  ${b.status || '—'}`);
      });
    }

    doc.end();
  } catch (err) {
    console.error('[reports] patientReport error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Error generando PDF' });
  }
};

module.exports = { bookingsReport, patientReport };
