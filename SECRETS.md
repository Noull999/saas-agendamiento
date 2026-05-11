# Secrets Management Guide

Secure handling of sensitive configuration and credentials for the SaaS Agendamiento application.

## Overview

This application requires sensitive data for operation:
- Encryption keys and JWT secrets
- Database credentials
- Third-party API keys (Stripe, Twilio, SMTP)
- Authentication tokens

**GOLDEN RULE:** Never commit secrets to version control. Never hardcode credentials in code.

## Development Environment

### 1. Setup Local `.env` File

Create `backend/.env` (never commit this file):

```bash
# Application
NODE_ENV=development
PORT=3001
JWT_SECRET=dev-secret-change-in-production
ENCRYPTION_KEY=dev-encryption-key-change-in-production-min-32-chars

# Database
DB_PATH=./data/saas.db

# Frontend (local)
FRONTEND_URL=http://localhost:5173

# Optional: Development Email/SMS (use test credentials)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-dev-email@gmail.com
SMTP_PASS=your-app-password
TWILIO_ACCOUNT_SID=test_account_sid
TWILIO_AUTH_TOKEN=test_auth_token
TWILIO_PHONE=+15551234567

# Optional: Development Stripe (use test keys)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_test_...

# Optional: Development Sentry
SENTRY_DSN=https://test-key@sentry.io/0
SENTRY_ENVIRONMENT=development

# Logging
LOG_LEVEL=debug
```

### 2. `.env` in `.gitignore`

Verify `.gitignore` contains:

```
backend/.env
backend/.env.local
backend/.env.*.local
.DS_Store
node_modules/
logs/
data/
dist/
```

### 3. Use `.env.example` for Documentation

Create `backend/.env.example` with dummy values (safe to commit):

```bash
# This file documents required environment variables.
# Copy to .env and fill with real values (never commit .env)

NODE_ENV=development
PORT=3001
JWT_SECRET=change_me_in_production_use_32_random_chars_minimum
ENCRYPTION_KEY=change_me_in_production_use_32_random_chars_minimum
DB_PATH=./data/saas.db
FRONTEND_URL=http://localhost:5173

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@example.com
SMTP_PASS=your_app_password
TWILIO_ACCOUNT_SID=AC_TEST_SID
TWILIO_AUTH_TOKEN=test_token
TWILIO_PHONE=+15551234567

STRIPE_SECRET_KEY=sk_test_example
STRIPE_PUBLISHABLE_KEY=pk_test_example
STRIPE_WEBHOOK_SECRET=whsec_test_example

SENTRY_DSN=https://example@sentry.io/0
SENTRY_ENVIRONMENT=development

LOG_LEVEL=debug
```

## Staging Environment

### 1. Secrets Storage Strategy

**DO NOT store secrets in git or container images.**

#### Option A: Environment Variables (Recommended for simple setup)

Store secrets in a secure file accessible only by the application:

```bash
# Create secure file (readable only by app user)
sudo tee /etc/saas-agendamiento/.env > /dev/null << EOF
NODE_ENV=staging
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
# ... other secrets
EOF

# Set permissions
sudo chmod 600 /etc/saas-agendamiento/.env
sudo chown app:app /etc/saas-agendamiento/.env

# Load in systemd service
[Service]
EnvironmentFile=/etc/saas-agendamiento/.env
ExecStart=/usr/bin/node src/index.js
```

#### Option B: AWS Secrets Manager

```bash
# Create secret
aws secretsmanager create-secret \
  --name saas-agendamiento-staging \
  --secret-string file://secrets.json \
  --region us-east-1

# Retrieve in application
const AWS = require('aws-sdk');
const client = new AWS.SecretsManager({ region: 'us-east-1' });

async function getSecrets() {
  const data = await client.getSecretValue({
    SecretId: 'saas-agendamiento-staging'
  }).promise();
  
  return JSON.parse(data.SecretString);
}
```

#### Option C: HashiCorp Vault

```bash
# Store secret
vault kv put saas-agendamiento/staging \
  jwt_secret=$(openssl rand -hex 32) \
  encryption_key=$(openssl rand -hex 32)

# Retrieve using app
const vault = require('node-vault')({
  endpoint: 'http://vault.example.com:8200',
  token: process.env.VAULT_TOKEN
});

const secret = await vault.read('saas-agendamiento/staging');
```

#### Option D: GitHub Actions Secrets (for CI/CD)

```yaml
# Store in GitHub Settings > Secrets > New repository secret
JWT_SECRET: <random-32-char-string>
ENCRYPTION_KEY: <random-32-char-string>
STRIPE_SECRET_KEY: sk_live_...

# Use in workflow
env:
  JWT_SECRET: ${{ secrets.JWT_SECRET }}
  ENCRYPTION_KEY: ${{ secrets.ENCRYPTION_KEY }}
```

## Production Environment

### 1. Security Requirements

✅ **MUST DO:**
- [ ] Encrypt secrets at rest
- [ ] Use strong, randomly-generated secrets (min 32 chars)
- [ ] Rotate secrets regularly (quarterly minimum)
- [ ] Limit access to secrets (principle of least privilege)
- [ ] Audit all access to secrets
- [ ] Use HTTPS/TLS for all secret transmission
- [ ] Implement secret versioning

❌ **MUST NOT DO:**
- [ ] Hardcode secrets in code
- [ ] Commit secrets to git
- [ ] Share secrets via email or chat
- [ ] Log secret values
- [ ] Use predictable/weak secrets
- [ ] Reuse secrets across environments

### 2. Generating Secure Secrets

```bash
# Generate 32-byte hex string (256 bits)
openssl rand -hex 32

# Output example: 
# a7f3c9e2d4b1f8a6c2e9d1f4a7b0c3d6e9f1a2b3c4d5e6f7a8b9c0d1e2f3

# JWT_SECRET - For signing JWT tokens
JWT_SECRET=$(openssl rand -hex 32)

# ENCRYPTION_KEY - For encrypting sensitive data
ENCRYPTION_KEY=$(openssl rand -hex 32)

# Store these securely (never in version control)
```

### 3. Third-Party API Keys

#### Stripe
```bash
# Obtain from: https://dashboard.stripe.com/apikeys

STRIPE_SECRET_KEY=sk_live_...  # Never share or log
STRIPE_PUBLISHABLE_KEY=pk_live_...  # Can be public
STRIPE_WEBHOOK_SECRET=whsec_...  # Keep secret

# Rotation: Generate new keys in Stripe dashboard
# Keep old keys until all services migrated
```

#### Twilio
```bash
# Obtain from: https://www.twilio.com/console

TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE=+1234567890

# Rotation: Generate new auth tokens in Twilio console
# Keep old tokens for 24-48 hours for graceful migration
```

#### SMTP/Email
```bash
# Gmail: Use App Passwords (not main password)
# https://support.google.com/accounts/answer/185833

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your_app_password  # Generate in Google Account security

# Rotation: Generate new app password when rotating
# Old password becomes invalid immediately
```

#### Sentry (Error Tracking)
```bash
# Obtain from: https://sentry.io/settings/account/projects/

SENTRY_DSN=https://key@o.ingest.sentry.io/project-id
SENTRY_ENVIRONMENT=production

# Rotation: Generate new auth token in Sentry dashboard
# DSN remains the same for public error reporting
```

### 4. Environment-Specific Secrets

Different secrets for each environment:

```
Development:    JWT_SECRET=dev-key-123
Staging:        JWT_SECRET=staging-key-456
Production:     JWT_SECRET=prod-key-789 (random 32+ chars)
```

Each environment requires:
- Separate Stripe keys (test vs live)
- Separate Twilio credentials
- Separate database encryption keys
- Separate email accounts

### 5. Secret Rotation Plan

#### Quarterly Rotation (Recommended)

```bash
# Step 1: Generate new secrets
NEW_JWT_SECRET=$(openssl rand -hex 32)
NEW_ENCRYPTION_KEY=$(openssl rand -hex 32)

# Step 2: Update in secrets manager
aws secretsmanager update-secret \
  --secret-id saas-agendamiento-prod \
  --secret-string "$(cat <<EOF
{
  "JWT_SECRET": "$NEW_JWT_SECRET",
  "ENCRYPTION_KEY": "$NEW_ENCRYPTION_KEY"
}
EOF
)"

# Step 3: Restart application
pm2 restart saas-agendamiento

# Step 4: Verify application running
curl https://api.yourdomain.com/health

# Step 5: Document rotation date
echo "JWT rotated on $(date)" >> /var/log/secrets-rotation.log
```

#### Manual Rotation Checklist
- [ ] Generate new secrets
- [ ] Update in secrets manager
- [ ] Test in staging first
- [ ] Deploy to production during low-traffic window
- [ ] Verify application functionality
- [ ] Monitor error logs for issues
- [ ] Keep old secrets for 24 hours for emergency rollback
- [ ] Document rotation date and time
- [ ] Update secret inventory

## Accessing Secrets in Code

### Development

```javascript
// Load from .env file
require('dotenv').config();

const jwtSecret = process.env.JWT_SECRET;
const encryptionKey = process.env.ENCRYPTION_KEY;
```

### Staging/Production

```javascript
// Load from secure source
let secrets = {};

if (process.env.AWS_REGION) {
  // Load from AWS Secrets Manager
  const AWS = require('aws-sdk');
  const client = new AWS.SecretsManager({ region: process.env.AWS_REGION });
  
  secrets = await client.getSecretValue({
    SecretId: `saas-agendamiento-${process.env.NODE_ENV}`
  }).promise().then(data => JSON.parse(data.SecretString));
} else {
  // Load from environment variables or file
  secrets = {
    JWT_SECRET: process.env.JWT_SECRET,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY
  };
}

// Use in application
const jwtSecret = secrets.JWT_SECRET;
```

## Audit & Monitoring

### Log Secret Access

Never log secret values. Instead:

```javascript
// BAD - Never do this
console.log('JWT_SECRET:', process.env.JWT_SECRET);

// GOOD - Log only that a secret was used
logger.info('Using JWT for token generation', { 
  feature: 'authentication',
  timestamp: new Date().toISOString()
});
```

### Detect Leaked Secrets

```bash
# Search git history for common patterns
git log --all -S "sk_live_" --oneline

# Check for secrets in files
grep -r "sk_live_\|pk_live_\|ACxxxxxxx" --include="*.js" .

# Use gitguardian hook
npm install -g gitguardian-cli
gitguardian scan
```

## Emergency Procedures

### If Secret is Leaked

1. **Immediate Actions** (within 1 hour)
   ```bash
   # Stop vulnerable application
   pm2 stop saas-agendamiento
   
   # Generate new secrets
   NEW_SECRET=$(openssl rand -hex 32)
   
   # Update in secrets manager
   aws secretsmanager update-secret --secret-id saas-agendamiento-prod \
     --secret-string "{\"JWT_SECRET\":\"$NEW_SECRET\"}"
   
   # Restart with new secret
   pm2 start saas-agendamiento
   ```

2. **Analysis** (within 4 hours)
   - [ ] Check if secret was used to access resources
   - [ ] Review CloudTrail/audit logs
   - [ ] Check API usage patterns
   - [ ] Look for unauthorized transactions

3. **Communication** (within 24 hours)
   - [ ] Notify security team
   - [ ] Document incident
   - [ ] Notify users if data accessed
   - [ ] Report to relevant authorities if required

### If Encryption Key is Compromised

This requires database re-encryption:

```bash
# 1. Stop application
pm2 stop saas-agendamiento

# 2. Backup database
cp /var/lib/saas-agendamiento/data/saas.db \
   /var/backups/saas-$(date +%Y%m%d_%H%M%S).db

# 3. Decrypt with old key and re-encrypt with new key
# (Requires custom migration script)
node scripts/reencrypt-database.js \
  --old-key "$OLD_ENCRYPTION_KEY" \
  --new-key "$NEW_ENCRYPTION_KEY"

# 4. Generate new key
NEW_ENCRYPTION_KEY=$(openssl rand -hex 32)

# 5. Update in secrets manager
aws secretsmanager update-secret \
  --secret-id saas-agendamiento-prod \
  --secret-string "{\"ENCRYPTION_KEY\":\"$NEW_ENCRYPTION_KEY\"}"

# 6. Restart application
pm2 start saas-agendamiento

# 7. Verify data integrity
curl -H "Authorization: Bearer $TEST_TOKEN" \
  https://api.yourdomain.com/api/auth/me
```

## Team Guidelines

### Who Has Access?

- **Developers**: Development secrets only
- **DevOps**: Staging & Production secrets
- **CTO/Lead**: All environments
- **CI/CD**: Staging & Production (via GitHub Actions)

### Onboarding Checklist

- [ ] Copy `.env.example` to `.env`
- [ ] Request development secrets from tech lead
- [ ] Test local application startup
- [ ] Verify no secrets committed to git
- [ ] Review this guide entirely

### Offboarding Checklist

- [ ] Remove from secrets manager access
- [ ] Rotate any secrets they had access to
- [ ] Remove SSH/API keys
- [ ] Verify no secrets remain in old machines/emails

## Tools & Resources

- **Secret Managers**: AWS Secrets Manager, HashiCorp Vault, Doppler
- **Scanning Tools**: GitGuardian, TruffleHog, detect-secrets
- **Rotation Tools**: AWS Secrets Manager Rotation, Vault automatic rotation
- **Monitoring**: CloudTrail, Vault audit logs, Sentry

## Compliance

### Standards Met
- OWASP Top 10: A02:2021 Cryptographic Failures
- PCI DSS: Requirement 2.2 (Configuration standards)
- GDPR: Article 32 (Security of processing)

### Audit Trail

```bash
# View secret access logs
tail -f /var/log/secrets-access.log

# Archive old logs (7 days)
find /var/log -name "secrets-*.log" -mtime +7 -compress -delete
```

---

**Remember**: Security is everyone's responsibility. When in doubt, ask your security team.
