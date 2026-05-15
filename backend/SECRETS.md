# Secret Management

## Generar Secrets Seguros

Usa `openssl` para generar secrets aleatorios seguros de 32 caracteres hexadecimales (64 caracteres):

```bash
# Generar JWT_SECRET
openssl rand -hex 32

# Generar ENCRYPTION_KEY
openssl rand -hex 32
```

Copiar el output y guardar en `.env` (nunca comitear a git).

## Environment Variables por Entorno

### Development (.env)

```
JWT_SECRET=<valor generado con openssl rand -hex 32>
ENCRYPTION_KEY=<valor generado con openssl rand -hex 32>
NODE_ENV=development
PORT=3001
DB_PATH=./data/saas.db
FRONTEND_URL=http://localhost:5173
```

Otros servicios (Twilio, Stripe, SMTP) pueden dejarse vacíos en development.

### Production

**Nunca guardar .env en git.** Usar uno de estos:

1. **AWS Secrets Manager** (recomendado)
   - Crear secretos en AWS
   - IAM role con permisos de lectura
   - Código carga secretos al startup

2. **HashiCorp Vault**
   - Almacenar secretos en Vault
   - Autenticación con service token
   - Sidecar inyecta secretos como env vars

3. **1Password Secrets Automation**
   - Integrarse con 1Password
   - Inyectar en CI/CD

4. **Deployment tool** (Vercel, Heroku, etc.)
   - Dashboard web para configurar env vars
   - Nunca visualizar en logs

## Secretos Requeridos en Producción

| Variable | Min Length | Generación | Rotación |
|----------|------------|------------|----------|
| JWT_SECRET | 32 chars | openssl rand -hex 32 | Cada 90 días |
| ENCRYPTION_KEY | 32 chars | openssl rand -hex 32 | Cada 90 días |
| STRIPE_SECRET_KEY | - | Dashboard Stripe | Según política Stripe |
| STRIPE_WEBHOOK_SECRET | - | Dashboard Stripe | Según política Stripe |
| TWILIO_AUTH_TOKEN | - | Dashboard Twilio | Según política Twilio |
| SENTRY_DSN | - | Dashboard Sentry | Según política Sentry |

## Checklist Producción

- [ ] .env.example en repo, .env en .gitignore
- [ ] JWT_SECRET rotado y válido (32+ caracteres, sin placeholder)
- [ ] ENCRYPTION_KEY rotado y válido (32+ caracteres, sin placeholder)
- [ ] Todos los secretos en sistema de secrets (AWS, Vault, etc.) - NO en .env
- [ ] Acceso a secretos auditado (quién, cuándo, desde dónde)
- [ ] Backup de secretos en lugar seguro
- [ ] Alertas si secrets se exponen en logs o errores
- [ ] Plan de rotación documentado (cada 90 días mínimo)
- [ ] Todos los servicios usan su propio token/key (no compartido)

## Validación al Startup

El servidor valida secretos al iniciar y falla con mensajes claros:

```
[FATAL] JWT_SECRET no configurada. Usa: openssl rand -hex 32
[FATAL] JWT_SECRET debe tener mínimo 32 caracteres
[FATAL] JWT_SECRET aún contiene valor de ejemplo. Configura un valor real
```

Nunca permite startup con placeholder values (`CHANGE_ME`, `example`, etc).

## Exposición Accidental

Si un secret se expone:

1. Revocar inmediatamente (cambiar en sistema de secrets)
2. Auditar logs (qué se accedió, cuándo)
3. Cambiar en todas las integraciones (Stripe, Twilio, etc.)
4. Documentar el incident
5. Rotación completa de secrets si es crítico

## Referencias

- [OWASP: Secrets Management](https://owasp.org/www-project-devsecops-guideline/)
- [AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/)
- [HashiCorp Vault](https://www.vaultproject.io/)
