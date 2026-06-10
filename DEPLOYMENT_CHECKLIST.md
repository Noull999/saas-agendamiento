# ✅ Checklist de Deployment a Producción

## FASE 1: Configuración Base (✅ COMPLETADO)

- [x] Migración PostgreSQL de SQLite
  - [x] 12 controladores convertidos a async/await
  - [x] Pool.query() para todas las operaciones
  - [x] AES-256-GCM para datos clínicos
  - [x] Cross-tenant validation implementado
  
- [x] Generación de claves seguras
  - [x] ENCRYPTION_KEY: 64 hex chars
  - [x] JWT_SECRET: 64 hex chars
  - [x] Guardadas en .env (no commiteado)
  
- [x] Script de migración automática
  - [x] `npm run migrate` - crea DB y schema
  - [x] Verifica PostgreSQL disponible
  - [x] Agrega columnas faltantes automáticamente
  
- [x] Documentación de setup
  - [x] SETUP_POSTGRESQL.md
  - [x] GET_API_KEYS.md
  - [x] DEPLOYMENT_CHECKLIST.md

---

## FASE 2: Instalación de PostgreSQL (⏳ USUARIO)

**Instrucciones en:** `SETUP_POSTGRESQL.md`

- [ ] Instalar PostgreSQL 14+ (Windows/Mac/Linux)
- [ ] Verificar instalación: `psql --version`
- [ ] Actualizar .env con credenciales reales
- [ ] Ejecutar: `npm run migrate`
- [ ] Verificar: `npm run dev` (debe conectar)

---

## FASE 3: API Keys Externas (⏳ USUARIO)

**Instrucciones en:** `GET_API_KEYS.md`

### Stripe (Pagos)
- [ ] Crear cuenta en https://dashboard.stripe.com
- [ ] Obtener Secret Key (sk_test_ o sk_live_)
- [ ] Crear 2 productos con precios recurrentes:
  - [ ] Pro: $19.990 CLP → Copiar Price ID
  - [ ] Business: $34.990 CLP → Copiar Price ID
- [ ] Configurar webhook: `/api/billing/webhook`
- [ ] Obtener Webhook Signing Secret
- [ ] Copiar a .env:
  ```
  STRIPE_SECRET_KEY=sk_test_xxx
  STRIPE_WEBHOOK_SECRET=whsec_xxx
  STRIPE_PRICE_PRO=price_xxx
  STRIPE_PRICE_BUSINESS=price_xxx
  ```

### Twilio (WhatsApp Reminders)
- [ ] Crear cuenta en https://www.twilio.com
- [ ] Copiar Account SID
- [ ] Copiar Auth Token
- [ ] Obtener número (sandbox o comprado)
- [ ] Copiar a .env:
  ```
  TWILIO_ACCOUNT_SID=ACxxx
  TWILIO_AUTH_TOKEN=xxx
  TWILIO_WHATSAPP_FROM=+1415523888
  ```

### Sentry (Opcional - Error Tracking)
- [ ] Crear proyecto en https://sentry.io
- [ ] Copiar DSN
- [ ] Copiar a .env:
  ```
  SENTRY_DSN=https://xxx@ooo.ingest.sentry.io/yyy
  ```

### SMTP (Opcional - Email Recovery)
- [ ] Configurar (Gmail, SendGrid, Mailgun)
- [ ] Copiar a .env:
  ```
  SMTP_HOST=smtp.gmail.com
  SMTP_PORT=587
  SMTP_USER=email@gmail.com
  SMTP_PASS=app_password
  ```

---

## FASE 4: Testing Local (✅ CÓDIGO LISTO)

```bash
cd backend

# Tests unitarios
npm test

# Levantar servidor
npm run dev

# Expected output:
# [DB] PostgreSQL connected successfully
# [API] Servidor corriendo en http://localhost:3001
```

- [ ] Tests pasan (32/32)
- [ ] Backend arranca sin errores
- [ ] Frontend conecta a backend

---

## FASE 5: Deployment a Producción (⏳ USUARIO)

### Opción A: Vercel + Heroku PostgreSQL

1. **Push a GitHub:**
   ```bash
   git add .
   git commit -m "feat: PostgreSQL migration ready for production"
   git push origin master
   ```

2. **Deploy Backend a Vercel:**
   - Ir a https://vercel.com
   - Conectar GitHub repo
   - Framework: Node.js
   - Root directory: `backend/`
   - Environment variables (Settings):
     ```
     JWT_SECRET=<nueva-clave-64-chars>
     ENCRYPTION_KEY=<nueva-clave-64-chars>
     DATABASE_URL=<Heroku-Postgres-URL>
     STRIPE_SECRET_KEY=sk_live_xxx
     STRIPE_WEBHOOK_SECRET=whsec_xxx
     STRIPE_PRICE_PRO=price_xxx
     STRIPE_PRICE_BUSINESS=price_xxx
     TWILIO_ACCOUNT_SID=ACxxx
     TWILIO_AUTH_TOKEN=xxx
     TWILIO_WHATSAPP_FROM=+1415523888
     SENTRY_DSN=https://xxx@ooo.ingest.sentry.io/yyy
     FRONTEND_URL=https://tu-dominio.com
     ```

3. **Deploy Frontend a Vercel:**
   - Root directory: `frontend/`
   - Build command: `npm run build`
   - Output: `dist/`

4. **Base de datos PostgreSQL:**
   - Opción 1: Heroku Postgres (gratuito con limitaciones)
   - Opción 2: Supabase (más barato, PostgreSQL puro)
   - Opción 3: AWS RDS
   - Opción 4: Railway

### Opción B: Docker + Railway/Render

1. **Crear Dockerfile:**
   ```dockerfile
   FROM node:18-alpine
   WORKDIR /app
   COPY backend/ .
   RUN npm install
   EXPOSE 3001
   CMD ["npm", "start"]
   ```

2. **Deploy a Railway/Render:**
   - Conectar GitHub
   - Deploy automático en cada push

### Configurar Webhook de Stripe

En dashboard Stripe:
- Endpoint URL: `https://tu-api-produccion.com/api/billing/webhook`
- Events: `checkout.session.completed`, `customer.subscription.deleted`
- Obtener nuevo Webhook Secret
- Actualizar `STRIPE_WEBHOOK_SECRET` en production

---

## FASE 6: Post-Deploy Verification (✅ USUARIO)

```bash
# Verificar health check
curl https://tu-api.com/health

# Debe responder:
# {"ok":true}
```

- [ ] API responde en /health
- [ ] JWT authentication funciona
- [ ] Bookings CRUD funciona
- [ ] Stripe checkout funciona
- [ ] Twilio reminders envían mensajes
- [ ] Audit logs se guardan

---

## Datos Sensibles: Rotación y Seguridad

### ⚠️ IMPORTANTE: ENCRYPTION_KEY

Si alguna vez la clave fue commiteada en git:

1. **Rotar clave:**
   - Generar nueva: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - Actualizar en producción
   
2. **Desencriptar datos con clave vieja:**
   - Script para re-encriptar consultations, prescriptions, patients
   
3. **Purgar historia de git:**
   ```bash
   git filter-repo --replace-text <(echo "OLD_KEY==>NEW_KEY")
   git push --force
   ```

### Variables que NUNCA van en repo:
- ✗ ENCRYPTION_KEY
- ✗ JWT_SECRET
- ✗ Database passwords
- ✗ API keys (Stripe, Twilio, etc.)
- ✗ Signing secrets

---

## Monitoreo Post-Deploy

- [ ] Configurar alertas en Sentry
- [ ] Monitoring de base de datos (CPU, memoria, conexiones)
- [ ] Logs de API (buscar errores 5xx)
- [ ] Webhook de Stripe: verificar eventos recibidos
- [ ] Twilio: verificar reminders enviados

---

## Rollback Plan

Si algo falla en producción:

```bash
# Volver a versión anterior
git revert <commit-hash>
git push

# En Vercel:
# Dashboard → Deployments → Redeploy previous
```

---

## Contact de Soporte

- Stripe: https://stripe.com/support
- Twilio: https://support.twilio.com
- PostgreSQL: https://www.postgresql.org/support/
- Vercel: https://vercel.com/support

---

**Estado Actual:** ✅ Código listo, esperando API keys
**Próximo Paso:** Instalar PostgreSQL local + obtener API keys
**Tiempo Estimado:** 2-3 horas (setup + testing + deploy)
