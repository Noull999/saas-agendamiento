function formatDatetime(isoString) {
  const d = new Date(isoString)
  const date = d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })
  const time = d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
  return `${date} a las ${time}`
}

async function notifyBooking({ clientName, clientPhone, clientEmail, serviceName, datetimeISO, businessName }) {
  const botUrl = process.env.WHATSAPP_BOT_URL
  if (!botUrl) return

  const secret = process.env.WHATSAPP_BOT_SECRET
  const headers = { 'Content-Type': 'application/json' }
  if (secret) headers['Authorization'] = `Bearer ${secret}`

  await fetch(`${botUrl}/notify`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: clientName,
      phone: clientPhone || '',
      clientEmail: clientEmail || '',
      service: serviceName || '',
      datetime: formatDatetime(datetimeISO),
      datetimeISO,
      businessName,
    }),
    signal: AbortSignal.timeout(5000),
  })
}

module.exports = { notifyBooking }
