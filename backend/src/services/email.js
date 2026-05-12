const nodemailer = require('nodemailer');

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

function formatDatetime(isoString) {
  const d = new Date(isoString);
  const date = d.toLocaleDateString('es-CL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const time = d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  return `${date} a las ${time}`;
}

async function sendBookingConfirmation({
  clientName, clientEmail, serviceName, datetimeISO,
  businessName, cancelToken, frontendUrl,
}) {
  if (!clientEmail) return;
  const transport = createTransport();
  if (!transport) return;

  const datetime = formatDatetime(datetimeISO);
  const baseUrl = frontendUrl || process.env.FRONTEND_URL || 'http://localhost:5173';
  const cancelLink = cancelToken ? `${baseUrl}/cancel/${cancelToken}` : null;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#ffffff;">
      <div style="background:linear-gradient(135deg,#1e293b,#4338ca);border-radius:16px;padding:28px;text-align:center;margin-bottom:24px;">
        <h1 style="color:#ffffff;margin:0;font-size:22px;">¡Reserva confirmada! ✅</h1>
      </div>

      <p style="color:#334155;font-size:15px;">Hola <strong>${clientName}</strong>,</p>
      <p style="color:#334155;font-size:15px;">Tu cita en <strong>${businessName}</strong> ha sido confirmada exitosamente.</p>

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:20px 0;">
        <table style="width:100%;border-collapse:collapse;">
          ${serviceName ? `
          <tr>
            <td style="color:#64748b;font-size:13px;padding:6px 0;width:40%;">Servicio</td>
            <td style="color:#1e293b;font-size:13px;font-weight:600;padding:6px 0;">${serviceName}</td>
          </tr>` : ''}
          <tr>
            <td style="color:#64748b;font-size:13px;padding:6px 0;">Fecha y hora</td>
            <td style="color:#1e293b;font-size:13px;font-weight:600;padding:6px 0;text-transform:capitalize;">${datetime}</td>
          </tr>
          <tr>
            <td style="color:#64748b;font-size:13px;padding:6px 0;">Negocio</td>
            <td style="color:#1e293b;font-size:13px;font-weight:600;padding:6px 0;">${businessName}</td>
          </tr>
        </table>
      </div>

      ${cancelLink ? `
      <div style="background:#fef9f0;border:1px solid #fed7aa;border-radius:12px;padding:16px;margin:20px 0;">
        <p style="color:#92400e;font-size:13px;margin:0 0 8px 0;">¿Necesitas cancelar?</p>
        <a href="${cancelLink}" style="color:#6366f1;font-size:13px;text-decoration:underline;">Cancelar mi reserva</a>
      </div>` : ''}

      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
      <p style="color:#94a3b8;font-size:12px;text-align:center;margin:0;">
        Este correo fue enviado automáticamente por ${businessName}.<br>
        Por favor no respondas a este correo.
      </p>
    </div>
  `;

  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: clientEmail,
    subject: `Confirmación de reserva — ${businessName}`,
    html,
  });
}

module.exports = { sendBookingConfirmation };
