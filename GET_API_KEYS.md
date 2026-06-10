# Obtener API Keys y Credenciales

## 1. STRIPE (Pagos)

### Paso 1: Crear cuenta en Stripe

1. Ir a https://dashboard.stripe.com/register
2. Registrarse con email de la empresa
3. Completar verificación (nombre, empresa, país)

### Paso 2: Obtener Secret Key

1. En Dashboard → Developers → API keys
2. Copiar **Secret Key** (comienza con `sk_live_` para producción o `sk_test_` para testing)
3. Guardar en variable: `STRIPE_SECRET_KEY`

### Paso 3: Crear Productos y Precios

**Plan Pro:**
1. Dashboard → Products → Add product
2. Nombre: "Pro Plan"
3. Billing → Recurring (Monthly)
4. Price: $19.990 CLP (o ajustar según tu mercado)
5. Copiar **Price ID** (comienza con `price_`)
6. Guardar en: `STRIPE_PRICE_PRO`

**Plan Business:**
1. Repetir para "Business Plan"
2. Price: $34.990 CLP
3. Guardar **Price ID** en: `STRIPE_PRICE_BUSINESS`

### Paso 4: Configurar Webhook

1. Dashboard → Developers → Webhooks
2. "Add endpoint"
3. Endpoint URL: `https://tu-api.com/api/billing/webhook`
4. Events to listen: 
   - `checkout.session.completed` ✓
   - `customer.subscription.deleted` ✓
5. Copiar **Signing Secret** (comienza con `whsec_`)
6. Guardar en: `STRIPE_WEBHOOK_SECRET`

### Variables a Guardar

```env
STRIPE_SECRET_KEY=sk_test_xxx  # O sk_live_ en producción
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_PRO=price_xxx
STRIPE_PRICE_BUSINESS=price_xxx
```

---

## 2. TWILIO (WhatsApp Reminders)

### Paso 1: Crear Cuenta Twilio

1. Ir a https://www.twilio.com/console/signup
2. Registrarse con teléfono
3. Confirmar email

### Paso 2: Obtener Credenciales

1. Ir a https://www.twilio.com/console
2. Copiar:
   - **Account SID** (comienza con `AC`)
   - **Auth Token** (largo string)

### Paso 3: Configurar WhatsApp

1. Console → Messaging → Try it out → Send an SMS
2. En "Phone Numbers" → seleccionar o comprar número
3. Alternativa: Usar sandbox de WhatsApp (número `+1 415 523 8886`)
4. Guardar el número usado en: `TWILIO_WHATSAPP_FROM`

### Verificar Número

```bash
# Enviar SMS de prueba desde Twilio Console
# Ir a: https://www.twilio.com/console/sms/getting-started
```

### Variables a Guardar

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=tu_auth_token_muy_largo
TWILIO_WHATSAPP_FROM=+1415523888  # O tu número comprado
```

---

## 3. SENTRY (Error Tracking - OPCIONAL)

### Paso 1: Crear Proyecto Sentry

1. Ir a https://sentry.io/signup/
2. Registrarse con GitHub/Google/Email
3. Crear proyecto → Select platform: Node.js

### Paso 2: Obtener DSN

1. Project Settings → Client Keys (DSN)
2. Copiar **DSN** (formato: `https://xxx@ooo.ingest.sentry.io/yyy`)

### Variables a Guardar

```env
SENTRY_DSN=https://xxx@ooo.ingest.sentry.io/yyy
```

**Nota:** El código ya está preparado para Sentry. Sin esta variable, simplemente no se reportarán errores remotos (funciona sin problemas).

---

## 4. SMTP (Email Recovery - OPCIONAL)

### Opción A: Gmail

1. Crear cuenta Google o usar existente
2. Activar "Less secure app access": https://myaccount.google.com/lesssecureapps
3. Alternativamente, crear **App Password** (recomendado):
   - Ir a https://myaccount.google.com/apppasswords
   - Seleccionar: Mail + Windows Computer
   - Copiar contraseña generada

### Variables a Guardar

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu_email@gmail.com
SMTP_PASS=app_password_generado  # O contraseña normal si "less secure" está activado
```

### Opción B: Mailgun / SendGrid (Profesional)

**Mailgun:**
1. https://www.mailgun.com/
2. Copiar API Key
3. Variables:
   ```env
   SMTP_HOST=smtp.mailgun.org
   SMTP_USER=postmaster@tu-dominio.mailgun.org
   SMTP_PASS=tu_api_key
   ```

**SendGrid:**
1. https://sendgrid.com/
2. Crear API Key
3. Variables:
   ```env
   SMTP_HOST=smtp.sendgrid.net
   SMTP_USER=apikey
   SMTP_PASS=SG.xxxxxxxxxxxxxxxxxxxxxx
   ```

---

## Checklist Final

### Desarrollo (Testing)

- [ ] Stripe Secret Key (`sk_test_xxx`)
- [ ] Stripe Price IDs (Pro + Business)
- [ ] Stripe Webhook Secret (`whsec_xxx`)
- [ ] Twilio Account SID
- [ ] Twilio Auth Token
- [ ] Twilio WhatsApp Number
- [ ] PostgreSQL corriendo (`npm run migrate`)

### Producción

- [ ] Generar nuevas ENCRYPTION_KEY y JWT_SECRET (no reutilizar las de desarrollo)
- [ ] Stripe Secret Key (`sk_live_xxx`)
- [ ] Stripe Webhook Secret (remoto)
- [ ] Twilio credentials (reutilizable)
- [ ] SENTRY_DSN (recomendado)
- [ ] SMTP configurado (recomendado)
- [ ] PostgreSQL remoto (AWS RDS, Heroku, Supabase, etc.)
- [ ] FRONTEND_URL actualizado (tu dominio)
- [ ] SSL/HTTPS configurado

---

## Resumen de Variables de Entorno

```env
# === CRÍTICOS ===
JWT_SECRET=<64-char-hex>                       # Generado
ENCRYPTION_KEY=<64-char-hex>                   # Generado

# === BASE DE DATOS ===
DATABASE_URL=postgresql://...                  # Tu PG

# === STRIPE ===
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_PRO=price_xxx
STRIPE_PRICE_BUSINESS=price_xxx

# === TWILIO ===
TWILIO_ACCOUNT_SID=ACxxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_WHATSAPP_FROM=+1415523888

# === OPCIONAL ===
SENTRY_DSN=https://xxx@ooo.ingest.sentry.io/yyy
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=email@gmail.com
SMTP_PASS=app_password
```

---

**¿Necesitas ayuda creando las APIs?**
- Sentry no es necesario para funcionar
- SMTP es necesario solo si usas recuperación de contraseña
- Twilio es necesario para recordatorios automáticos
- Stripe es necesario para cobrar
