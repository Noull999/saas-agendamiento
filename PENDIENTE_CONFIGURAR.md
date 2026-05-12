# Pendiente configurar en producción

Todo el código está listo. Solo faltan estas variables de entorno en el servidor.

---

## 1. ENCRYPTION_KEY (obligatorio — sin esto el servidor no arranca)

> ⚠️ NUNCA comitees la clave real. Genérala SOLO en el servidor / gestor de secretos.

Generar (64 hex chars = 32 bytes):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Configurar como variable de entorno (Vercel/host) — no en el repo:

```
ENCRYPTION_KEY=<el valor generado>
```

Guarda esta clave en un gestor de secretos. Si se pierde, los datos clínicos
encriptados quedan irrecuperables.

> Si una clave fue comiteada previamente, se considera comprometida: rotar de
> inmediato, descifrar/recifrar los registros existentes con la nueva clave y
> purgar la historia de git (`git filter-repo` o BFG).

---

## 2. WhatsApp via Twilio (para recordatorios y confirmaciones)

```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=tu_auth_token
TWILIO_WHATSAPP_FROM=+14155238886
```

Obtén estas en https://console.twilio.com. El número de sandbox para pruebas es +1 415 523 8886.
El job de recordatorios ya corre cada 30 min — solo necesita estas vars para enviar.

---

## 3. Stripe (para cobrar planes Pro / Clínica)

```
STRIPE_SECRET_KEY=sk_live_xxx        # usa sk_test_xxx para probar
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_PRO=price_xxx
STRIPE_PRICE_CLINICA=price_xxx
```

Pasos en Stripe Dashboard:
1. Crear dos productos con precio recurrente mensual (Pro: $19.990 CLP, Clínica: $49.990 CLP)
2. Copiar los Price IDs (price_xxx) a las vars de arriba
3. En Webhooks → añadir endpoint: https://tu-api.com/api/billing/webhook
   - Eventos a escuchar: checkout.session.completed, customer.subscription.deleted
4. Copiar el Signing Secret (whsec_xxx) a STRIPE_WEBHOOK_SECRET

El frontend puede iniciar el pago llamando a POST /api/billing/checkout con { "plan": "pro" } o { "plan": "clinica" }.

---

## Resumen de lo que se hizo en código (referencia)

| Área | Qué se hizo |
|------|-------------|
| Git | Merge feat/saas-salud-vertical → master (16 commits) |
| Bug #9 | PRAGMA encoding='UTF-8' en database.js |
| Bug #10 | GET /api/professionals/:id (getOne) |
| Bug #11 | Rate limiter desactivado en NODE_ENV=development |
| Recordatorios | jobs/reminders.js — cron cada 30 min, columna reminded |
| WhatsApp | Twilio REST directo en whatsapp.js (sin SDK) |
| Pagos | Stripe Checkout + webhook en /api/billing |
| Tests | 32 tests Jest — crypto.js y rut.js (npm test) |
| Frontend | React.lazy() en 8 páginas — bundle bajó de 703 KB a 250 KB |
