# 🚀 Guía Completa de Deployment

## Estado Actual

**Backend:** ✅ Listo para producción
**Código:** ✅ PostgreSQL migrado, 12 controladores convertidos, tests pasando (32/32)
**Seguridad:** ✅ Implementada (JWT, rate limiting, encryption, audit logs)

---

## 🔧 Pasos para Deployar

### PASO 1: Instalar PostgreSQL Localmente

**Windows:**
1. Descargar: https://www.postgresql.org/download/windows/
2. Durante instalación, anotar contraseña del usuario `postgres`
3. Verificar: `psql --version`

**macOS:**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Linux (Ubuntu):**
```bash
sudo apt-get update && sudo apt-get install postgresql
sudo systemctl start postgresql
```

### PASO 2: Crear Base de Datos y Ejecutar Migraciones

```bash
cd backend
npm run migrate
```

**Salida esperada:**
```
[MIGRATION] PostgreSQL connected successfully
[MIGRATION] ✓ Schema creado exitosamente
[MIGRATION] ✓ Todas las migraciones completadas
```

### PASO 3: Obtener API Keys

**Siguiendo instrucciones en GET_API_KEYS.md:**

#### STRIPE (Pagos)
1. https://dashboard.stripe.com → Registrarse
2. Developers → API keys → Copiar Secret Key (`sk_test_xxx`)
3. Crear 2 productos:
   - Pro: $19.990 CLP → Copiar Price ID
   - Business: $34.990 CLP → Copiar Price ID
4. Webhooks → Add endpoint: `https://tu-api.com/api/billing/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.deleted`
   - Copiar Signing Secret (`whsec_xxx`)

#### TWILIO (WhatsApp)
1. https://www.twilio.com → Registrarse
2. Console → Copiar Account SID y Auth Token
3. Obtener número (sandbox o comprado)

#### SENTRY (Opcional - Error Tracking)
1. https://sentry.io → Crear proyecto Node.js
2. Copiar DSN

#### SMTP (Opcional - Email)
1. Gmail / SendGrid / Mailgun
2. Copiar credenciales

### PASO 4: Actualizar .env en Backend

```bash
cat backend/.env
```

Asegúrese que contiene:

```env
# === CRÍTICOS ===
JWT_SECRET=3d809dc45720e6f93a0a7cee2c6ede4b36421bc4f2a1f94e3c548750fcdc9139
ENCRYPTION_KEY=38ffbd729512bcbd10e744e3860816f25abfdf148fdece15672e44c877834ef6

# === BASE DE DATOS ===
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/saas_dev

# === STRIPE ===
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_PRO=price_xxx
STRIPE_PRICE_BUSINESS=price_xxx

# === TWILIO ===
TWILIO_ACCOUNT_SID=ACxxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_WHATSAPP_FROM=+1415523888

# === OPCIONALES ===
SENTRY_DSN=
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
```

### PASO 5: Verificar que Todo Funciona Localmente

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Debe mostrar:
# [DB] PostgreSQL connected successfully
# [API] Servidor corriendo en http://localhost:3001

# Terminal 2: Tests
cd backend
npm test

# Debe mostrar:
# Tests: 32 passed, 32 total
```

### PASO 6: Deployar a Producción

#### Opción A: Vercel (Recomendado)

```bash
# Push a GitHub
git push origin master

# En https://vercel.com:
# 1. Conectar GitHub
# 2. Importar proyecto
# 3. Root directory: backend/
# 4. Settings → Environment Variables:
#    - JWT_SECRET (NUEVA - generar)
#    - ENCRYPTION_KEY (NUEVA - generar)
#    - DATABASE_URL (de Heroku Postgres/Supabase)
#    - Todas las vars de STRIPE, TWILIO, etc.
# 5. Deploy
```

#### Opción B: Railway/Render

```bash
# Conectar GitHub, setear environment variables, deploy automático
```

---

## 🔐 Variables de Entorno para Producción

**IMPORTANTE:** Generar NUEVAS claves, NO reutilizar las de desarrollo:

```bash
# Generar nuevas claves seguras
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
```

**En production, usar:**
- `STRIPE_SECRET_KEY=sk_live_xxx` (no sk_test_)
- `NODE_ENV=production`
- SSL/HTTPS activado
- Base de datos PostgreSQL remota (AWS RDS, Supabase, Heroku, Railway)

---

## 📋 Checklist Pre-Deploy

- [ ] PostgreSQL instalado y verificado localmente
- [ ] `npm run migrate` ejecutado sin errores
- [ ] `npm test` pasando (32/32)
- [ ] `npm run dev` iniciando backend correctamente
- [ ] Frontend conectando a backend local
- [ ] API keys de Stripe obtenidas y verificadas
- [ ] API keys de Twilio obtenidas
- [ ] .env actualizado con todas las variables
- [ ] Webhook de Stripe configurado
- [ ] Nueva ENCRYPTION_KEY generada para producción
- [ ] Nueva JWT_SECRET generada para producción
- [ ] DATABASE_URL remoto obtido (Supabase/Heroku/AWS)
- [ ] FRONTEND_URL actualizado al dominio final
- [ ] Repositorio pusheado a GitHub

---

## 🔧 Troubleshooting

### "connection refused"
```bash
# PostgreSQL no está corriendo
# Solución: pg_ctl start (Windows) o brew services start postgresql@15 (Mac)
```

### "password authentication failed"
```bash
# Credenciales incorrectas en .env
# Verificar DB_USER, DB_PASSWORD
```

### "database does not exist"
```bash
# Base de datos no creada
# Solución: npm run migrate
```

### "ENCRYPTION_KEY debe tener mínimo 32 caracteres"
```bash
# La clave es muy corta
# Verificar que tenga 64 hex characters (32 bytes)
```

---

## 📞 Contacto y Soporte

- Stripe Support: https://stripe.com/support
- Twilio Support: https://support.twilio.com
- PostgreSQL Docs: https://www.postgresql.org/docs/
- Vercel Support: https://vercel.com/support

---

## 🚀 Próximos Pasos

1. Instalar PostgreSQL
2. Ejecutar `npm run migrate`
3. Obtener API keys (Stripe, Twilio)
4. Actualizar .env
5. Testear localmente
6. Pushear a GitHub
7. Deployar a Vercel/Railway
8. Configurar webhook de Stripe en producción
9. Verificar reminders de Twilio
10. Monitorear con Sentry

---

**Tiempo estimado:** 2-3 horas
**Complejidad:** Media (mayormente setup de credenciales)
**Riesgo:** Bajo (código verificado y seguro)
