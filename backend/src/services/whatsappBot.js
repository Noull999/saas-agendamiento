const crypto = require('crypto');
const db = require('../db/database');

// ── Bot conversacional de reservas por WhatsApp ──────────────────────────────
// Recibe mensajes entrantes (vía webhook de Twilio) y guía al cliente paso a
// paso para crear una reserva. El estado de cada conversación se guarda en la
// tabla whatsapp_sessions, identificado por el número de teléfono.

const DAYS_ES   = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hora de inactividad

function safeParseSlots(raw) {
  try { const p = typeof raw === 'string' ? JSON.parse(raw) : raw; return Array.isArray(p) ? p : []; }
  catch { return []; }
}

function expandRange(start, end, stepMin = 30) {
  const slots = [];
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let cur = sh * 60 + sm;
  const endMins = eh * 60 + em;
  while (cur < endMins) {
    slots.push(`${String(Math.floor(cur / 60)).padStart(2, '0')}:${String(cur % 60).padStart(2, '0')}`);
    cur += stepMin;
  }
  return slots;
}

// Días con disponibilidad para los próximos N días
async function getAvailableDays(businessId, stepMin, limit = 6) {
  const { rows: scheduleRows } = await db.query(
    'SELECT dow, slots FROM schedules WHERE business_id = $1', [businessId]
  );
  const scheduleMap = {};
  scheduleRows.forEach(r => { scheduleMap[r.dow] = safeParseSlots(r.slots); });

  const result = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 30 && result.length < limit; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const ranges = scheduleMap[d.getDay()] || [];
    if (!ranges.length) continue;
    const dateStr = d.toISOString().slice(0, 10);
    const slots = await getAvailableSlots(businessId, dateStr, ranges, stepMin);
    if (slots.length) {
      result.push({ dateStr, label: `${DAYS_ES[d.getDay()]} ${d.getDate()} de ${MONTHS_ES[d.getMonth()]}` });
    }
  }
  return result;
}

async function getAvailableSlots(businessId, dateStr, ranges = null, stepMin = 30) {
  if (!ranges) {
    const d = new Date(dateStr + 'T00:00:00');
    const { rows } = await db.query('SELECT slots FROM schedules WHERE business_id = $1 AND dow = $2', [businessId, d.getDay()]);
    ranges = rows[0] ? safeParseSlots(rows[0].slots) : [];
  }
  if (!ranges.length) return [];
  const { rows: bookedRows } = await db.query(
    `SELECT SUBSTRING(datetime_iso FROM 12 FOR 5) AS t FROM bookings
      WHERE business_id = $1 AND LEFT(datetime_iso, 10) = $2 AND status != 'cancelled'`,
    [businessId, dateStr]
  );
  const booked = bookedRows.map(r => r.t);
  const all = ranges.flatMap(r => expandRange(r.start, r.end, stepMin));
  return all.filter(t => !booked.includes(t));
}

// ── Estado de sesión ─────────────────────────────────────────────────────────
async function getSession(phone) {
  const { rows } = await db.query('SELECT * FROM whatsapp_sessions WHERE phone = $1', [phone]);
  const s = rows[0];
  if (!s) return null;
  if (Date.now() - new Date(s.updated_at).getTime() > SESSION_TTL_MS) {
    await clearSession(phone);
    return null;
  }
  return s;
}

async function saveSession(phone, businessId, step, data) {
  await db.query(
    `INSERT INTO whatsapp_sessions (phone, business_id, step, data, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (phone) DO UPDATE SET business_id = $2, step = $3, data = $4, updated_at = NOW()`,
    [phone, businessId, step, JSON.stringify(data)]
  );
}

async function clearSession(phone) {
  await db.query('DELETE FROM whatsapp_sessions WHERE phone = $1', [phone]);
}

// Resuelve el negocio a partir del texto (busca "código: <slug>" o el slug suelto)
async function resolveBusiness(text) {
  const codeMatch = text.match(/c[oó]digo:?\s*([a-z0-9-]+)/i);
  const candidate = codeMatch ? codeMatch[1] : null;
  if (candidate) {
    const { rows } = await db.query('SELECT id, name, plan FROM businesses WHERE slug = $1', [candidate.toLowerCase()]);
    if (rows[0]) return rows[0];
  }
  return null;
}

function pickNumber(text, max) {
  const n = parseInt(String(text).trim(), 10);
  if (Number.isInteger(n) && n >= 1 && n <= max) return n;
  return null;
}

// ── Manejo principal del mensaje entrante ────────────────────────────────────
// Devuelve el texto de respuesta para el cliente.
async function handleIncoming(phone, rawText) {
  const text = (rawText || '').trim();
  const lower = text.toLowerCase();

  // Comandos globales
  if (['cancelar', 'salir', 'cancel', 'stop'].includes(lower)) {
    await clearSession(phone);
    return 'Conversación cancelada. Escríbeme cuando quieras reservar 👋';
  }

  let session = await getSession(phone);

  // Sin sesión activa → intentar resolver negocio e iniciar
  if (!session) {
    const business = await resolveBusiness(text);
    if (!business) {
      return '👋 ¡Hola! Para reservar por WhatsApp, abre el enlace "Reservar por WhatsApp" desde la página del negocio. Así sé con quién quieres agendar.';
    }
    if (!['pro', 'business'].includes(business.plan)) {
      return `Lo siento, ${business.name} no tiene habilitada la reserva por WhatsApp. Puedes reservar desde su página web 🙂`;
    }
    return startServiceStep(phone, business);
  }

  // Con sesión activa → según el paso
  switch (session.step) {
    case 'awaiting_service': return handleServicePick(phone, session, text);
    case 'awaiting_date':    return handleDatePick(phone, session, text);
    case 'awaiting_time':    return handleTimePick(phone, session, text);
    case 'awaiting_name':    return handleName(phone, session, text);
    case 'awaiting_confirm': return handleConfirm(phone, session, lower);
    default:
      await clearSession(phone);
      return 'Reiniciemos. Abre el enlace "Reservar por WhatsApp" desde la página del negocio.';
  }
}

async function startServiceStep(phone, business) {
  const { rows: services } = await db.query(
    'SELECT id, name, price, duration_min FROM services WHERE business_id = $1 AND active = 1 ORDER BY id',
    [business.id]
  );
  if (!services.length) {
    await clearSession(phone);
    return `${business.name} aún no tiene servicios disponibles para reservar.`;
  }
  const list = services.map((s, i) =>
    `${i + 1}. ${s.name}${s.price > 0 ? ` — $${Number(s.price).toLocaleString('es-CL')}` : ''}`
  ).join('\n');
  await saveSession(phone, business.id, 'awaiting_service', {
    businessName: business.name,
    services: services.map(s => ({ id: s.id, name: s.name, price: s.price, duration_min: s.duration_min })),
  });
  return `👋 ¡Hola! Bienvenido a *${business.name}*.\n\n¿Qué servicio quieres reservar? Responde con el número:\n\n${list}\n\n_Escribe "cancelar" para salir._`;
}

async function handleServicePick(phone, session, text) {
  const data = session.data;
  const idx = pickNumber(text, data.services.length);
  if (!idx) return `No entendí. Responde con el número del servicio (1 al ${data.services.length}).`;
  const service = data.services[idx - 1];

  const days = await getAvailableDays(session.business_id, service.duration_min || 30);
  if (!days.length) {
    await clearSession(phone);
    return 'No hay horarios disponibles en los próximos días. Intenta más tarde o contacta al negocio.';
  }
  const list = days.map((d, i) => `${i + 1}. ${d.label}`).join('\n');
  await saveSession(phone, session.business_id, 'awaiting_date', { ...data, service, days });
  return `Elegiste *${service.name}*.\n\n¿Para qué día? Responde con el número:\n\n${list}`;
}

async function handleDatePick(phone, session, text) {
  const data = session.data;
  const idx = pickNumber(text, data.days.length);
  if (!idx) return `Responde con el número del día (1 al ${data.days.length}).`;
  const day = data.days[idx - 1];

  const slots = await getAvailableSlots(session.business_id, day.dateStr, null, data.service.duration_min || 30);
  if (!slots.length) {
    return 'Ese día se llenó. Elige otro número de la lista anterior.';
  }
  const list = slots.map((s, i) => `${i + 1}. ${s}`).join('\n');
  await saveSession(phone, session.business_id, 'awaiting_time', { ...data, day, slots });
  return `📅 ${day.label}.\n\n¿A qué hora? Responde con el número:\n\n${list}`;
}

async function handleTimePick(phone, session, text) {
  const data = session.data;
  const idx = pickNumber(text, data.slots.length);
  if (!idx) return `Responde con el número del horario (1 al ${data.slots.length}).`;
  const time = data.slots[idx - 1];
  await saveSession(phone, session.business_id, 'awaiting_name', { ...data, time });
  return `🕐 ${time} hrs.\n\nPor último, ¿a nombre de quién hago la reserva?`;
}

async function handleName(phone, session, text) {
  const name = text.slice(0, 80).trim();
  if (name.length < 2) return 'Por favor escribe tu nombre completo.';
  const data = session.data;
  await saveSession(phone, session.business_id, 'awaiting_confirm', { ...data, clientName: name });
  const priceLine = data.service.price > 0 ? `\n💵 Valor: $${Number(data.service.price).toLocaleString('es-CL')}` : '';
  return `Confirma tu reserva:\n\n👤 ${name}\n🛎 ${data.service.name}\n📅 ${data.day.label}\n🕐 ${data.time} hrs${priceLine}\n\nResponde *SÍ* para confirmar o *NO* para cancelar.`;
}

async function handleConfirm(phone, session, lower) {
  if (['no', 'n'].includes(lower)) {
    await clearSession(phone);
    return 'Reserva cancelada. Escríbeme cuando quieras agendar 👋';
  }
  if (!['si', 'sí', 's', 'yes', 'confirmar'].includes(lower)) {
    return 'Responde *SÍ* para confirmar o *NO* para cancelar.';
  }

  const data = session.data;
  const datetimeISO = `${data.day.dateStr}T${data.time}:00`;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    // Verificar que el horario siga libre (evita doble reserva)
    const { rows: clash } = await client.query(
      `SELECT id FROM bookings WHERE business_id = $1 AND datetime_iso = $2 AND status != 'cancelled' LIMIT 1`,
      [session.business_id, datetimeISO]
    );
    if (clash[0]) {
      await client.query('ROLLBACK');
      await saveSession(phone, session.business_id, 'awaiting_service', { businessName: data.businessName, services: data.services });
      return 'Ese horario se acaba de ocupar 😕. Empecemos de nuevo: ¿qué servicio quieres? (responde el número o escribe "cancelar")';
    }
    const cancelToken = crypto.randomBytes(16).toString('hex');
    await client.query(
      `INSERT INTO bookings (business_id, service_id, client_name, client_phone, datetime_iso, source, cancel_token, data_consent_at)
       VALUES ($1, $2, $3, $4, $5, 'whatsapp', $6, NOW())`,
      [session.business_id, data.service.id, data.clientName, phone, datetimeISO, cancelToken]
    );
    await client.query('COMMIT');

    await clearSession(phone);
    const frontendUrl = process.env.FRONTEND_URL || '';
    const cancelLine = frontendUrl ? `\n\nSi necesitas cancelar: ${frontendUrl}/cancel/${cancelToken}` : '';
    return `✅ ¡Reserva confirmada!\n\n🛎 ${data.service.name}\n📅 ${data.day.label}\n🕐 ${data.time} hrs\n\nTe esperamos 🙌${cancelLine}`;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[whatsappBot] error creando reserva:', err.message);
    await clearSession(phone);
    return 'Hubo un error al confirmar tu reserva. Por favor intenta de nuevo más tarde.';
  } finally {
    client.release();
  }
}

module.exports = { handleIncoming };
