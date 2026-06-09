const db = require('../db/database');

const DEFAULTS = {
  booking_confirmation: {
    whatsapp: `Hola {{clientName}} 👋\nTu reserva en *{{businessName}}* está confirmada.\n📅 {{date}} a las {{time}}\n💼 {{serviceName}}\n\nPara cancelar: {{cancelLink}}`,
    email_subject: `Reserva confirmada — {{businessName}}`,
    email_body: `<p>Hola <strong>{{clientName}}</strong>,</p><p>Tu reserva en <strong>{{businessName}}</strong> ha sido confirmada para el <strong>{{date}}</strong> a las <strong>{{time}}</strong>.</p><p>Servicio: {{serviceName}}</p><p><a href="{{cancelLink}}">Cancelar reserva</a></p>`,
  },
  reminder: {
    whatsapp: `Recordatorio 📅\nHola {{clientName}}, mañana tienes una cita en *{{businessName}}*\n🕐 {{date}} a las {{time}}\n💼 {{serviceName}}`,
    email_subject: `Recordatorio: cita mañana en {{businessName}}`,
    email_body: `<p>Hola <strong>{{clientName}}</strong>, te recordamos que mañana tienes una cita en <strong>{{businessName}}</strong> a las <strong>{{time}}</strong>.</p>`,
  },
  cancellation: {
    whatsapp: `Tu reserva en *{{businessName}}* del {{date}} a las {{time}} ha sido cancelada.`,
    email_subject: `Reserva cancelada — {{businessName}}`,
    email_body: `<p>Tu reserva en <strong>{{businessName}}</strong> del <strong>{{date}}</strong> ha sido cancelada.</p>`,
  },
};

async function getTemplate(businessId, type, channel) {
  try {
    const { rows } = await db.query(
      'SELECT content FROM message_templates WHERE business_id = $1 AND type = $2 AND channel = $3',
      [businessId, type, channel]
    );
    return rows[0]?.content || DEFAULTS[type]?.[channel] || '';
  } catch {
    // If table doesn't exist yet or any DB error, fall back to default
    return DEFAULTS[type]?.[channel] || '';
  }
}

function renderTemplate(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

module.exports = { getTemplate, renderTemplate, DEFAULTS };
