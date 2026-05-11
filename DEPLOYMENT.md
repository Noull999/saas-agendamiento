# Deployment Guide - SaaS Agendamiento

Production deployment guide for the multi-tenant booking and page builder system.

## Prerequisites

- Node.js 18+ 
- SQLite3 or higher
- Git access to repository
- SSL/TLS certificates (production)
- SMTP credentials for email notifications
- Stripe account (for billing)
- Sentry account (for error tracking)
- Environment-specific configuration

## Environment Setup

### 1. Environment Variables

Create `.env` file with production values:

```bash
# Application
NODE_ENV=production
PORT=3001
JWT_SECRET=<generate-with-openssl-rand-hex-32>
ENCRYPTION_KEY=<generate-with-openssl-rand-hex-32>  # Min 32 chars

# Database
DB_PATH=/var/lib/saas-agendamiento/data/saas.db
DB_BACKUP_DIR=/var/backups/saas-agendamiento

# Frontend URLs (CORS)
FRONTEND_URL=https://yourdomain.com

# Email/SMS
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE=+1234567890

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Error Tracking
SENTRY_DSN=https://your-key@sentry.io/project-id
SENTRY_ENVIRONMENT=production

# Logging
LOG_LEVEL=info
LOG_DIR=/var/log/saas-agendamiento
```

**CRITICAL:** Use strong, randomly generated values for secrets. Never commit `.env` to git.

### 2. Generate Secure Secrets

```bash
# Generate JWT_SECRET (32+ chars)
openssl rand -hex 32

# Generate ENCRYPTION_KEY (32+ chars)
openssl rand -hex 32

# Store in secure vault (AWS Secrets Manager, HashiCorp Vault, etc.)
```

## Installation

### 1. Clone Repository

```bash
git clone <repository-url> saas-agendamiento
cd saas-agendamiento/backend
```

### 2. Install Dependencies

```bash
npm install --production
```

### 3. Database Setup

```bash
# Create database directory
mkdir -p /var/lib/saas-agendamiento/data
mkdir -p /var/backups/saas-agendamiento
mkdir -p /var/log/saas-agendamiento

# Set permissions
chown -R app:app /var/lib/saas-agendamiento
chown -R app:app /var/log/saas-agendamiento
chmod 700 /var/lib/saas-agendamiento/data
```

### 4. Initialize Database

```bash
node -e "require('./src/db/database')"
```

This creates the SQLite database with all tables and indexes.

### 5. Seed Templates

Templates are auto-seeded on first run. Verify:

```bash
sqlite3 /var/lib/saas-agendamiento/data/saas.db "SELECT COUNT(*) FROM page_templates"
# Should return: 5
```

## Deployment Strategies

### Option A: Traditional VPS (DigitalOcean, Linode, AWS EC2)

#### 1. System Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Create application user
sudo useradd -m -d /var/lib/saas-agendamiento -s /bin/bash app

# Install PM2 for process management
sudo npm install -g pm2
```

#### 2. Application Deployment

```bash
# Deploy code
cd /opt/saas-agendamiento
git clone <repository-url> .
cd backend
npm install --production

# Configure PM2
pm2 start src/index.js --name saas-agendamiento
pm2 save
sudo pm2 startup systemd -u app --hp /var/lib/saas-agendamiento
```

#### 3. Nginx Reverse Proxy

```nginx
server {
  listen 443 ssl http2;
  server_name api.yourdomain.com;

  ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_ciphers HIGH:!aNULL:!MD5;

  location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
  }
}
```

#### 4. SSL Certificates

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Generate certificate
sudo certbot certonly --nginx -d api.yourdomain.com -d www.yourdomain.com

# Auto-renewal
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

### Option B: Docker Deployment

#### 1. Create Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY backend/src ./src

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "src/index.js"]
```

#### 2. Docker Compose

```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
      - DB_PATH=/data/saas.db
    volumes:
      - ./data:/data
      - ./logs:/app/logs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - /etc/letsencrypt:/etc/letsencrypt
    depends_on:
      - api
```

### Option C: Vercel Deployment

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Configure environment variables in Vercel dashboard
# Deploy with: vercel --prod
```

## Database Migrations

### Backup Before Migration

```bash
# Create backup
sqlite3 /var/lib/saas-agendamiento/data/saas.db ".backup /var/backups/saas-agendamiento/saas-$(date +%Y%m%d_%H%M%S).db"

# Test backup integrity
sqlite3 /var/backups/saas-agendamiento/saas-*.db "SELECT COUNT(*) FROM businesses"
```

### Adding New Columns

```bash
# Test in development first
npm test

# Apply migration
sqlite3 /var/lib/saas-agendamiento/data/saas.db "ALTER TABLE businesses ADD COLUMN new_column TEXT DEFAULT '';"

# Verify
sqlite3 /var/lib/saas-agendamiento/data/saas.db ".schema businesses"
```

## Health Checks & Monitoring

### Health Endpoint

```bash
curl https://api.yourdomain.com/health
# Response: {"ok": true}
```

### Application Logs

```bash
# View logs
tail -f /var/log/saas-agendamiento/app.log
tail -f /var/log/saas-agendamiento/error.log

# Search for errors
grep ERROR /var/log/saas-agendamiento/app.log | tail -50
```

### Database Health

```bash
# Check database integrity
sqlite3 /var/lib/saas-agendamiento/data/saas.db "PRAGMA integrity_check"
# Response: ok

# Monitor query performance
sqlite3 /var/lib/saas-agendamiento/data/saas.db ".timer on"
sqlite3 /var/lib/saas-agendamiento/data/saas.db "SELECT COUNT(*) FROM bookings"
```

## Automated Backups

### Backup Script

Create `/opt/saas-agendamiento/backup.sh`:

```bash
#!/bin/bash
set -e

BACKUP_DIR="/var/backups/saas-agendamiento"
DB_PATH="/var/lib/saas-agendamiento/data/saas.db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/saas-$TIMESTAMP.db"

# Create backup
sqlite3 "$DB_PATH" ".backup $BACKUP_FILE"

# Verify backup
if ! sqlite3 "$BACKUP_FILE" "PRAGMA integrity_check" | grep -q "ok"; then
  echo "Backup verification failed!"
  rm "$BACKUP_FILE"
  exit 1
fi

# Keep last 7 days of backups
find "$BACKUP_DIR" -name "saas-*.db" -mtime +7 -delete

echo "Backup created: $BACKUP_FILE"
```

### Schedule with Cron

```bash
# Edit crontab
sudo crontab -e

# Add daily backup at 2 AM
0 2 * * * /opt/saas-agendamiento/backup.sh >> /var/log/saas-backup.log 2>&1
```

## Rollback Procedures

### Immediate Rollback (Last Deployment)

```bash
# Using PM2
pm2 stop saas-agendamiento
cd /opt/saas-agendamiento
git revert HEAD --no-edit
npm install --production
pm2 start saas-agendamiento

# Verify
curl https://api.yourdomain.com/health
```

### Database Rollback

```bash
# List available backups
ls -lh /var/backups/saas-agendamiento/

# Restore from backup
cp /var/backups/saas-agendamiento/saas-20250101_020000.db /var/lib/saas-agendamiento/data/saas.db

# Restart application
pm2 restart saas-agendamiento
```

### Verify After Rollback

```bash
# Check application
pm2 logs saas-agendamiento

# Check database
sqlite3 /var/lib/saas-agendamiento/data/saas.db "SELECT COUNT(*) FROM businesses"

# Monitor error logs
tail -20 /var/log/saas-agendamiento/error.log
```

## Performance Optimization

### Enable Database Query Cache

Update `backend/src/index.js`:

```javascript
// Add caching for static endpoints
const cache = require('express-cache-middleware');

app.use(cache({
  routes: [
    '/api/page-builder/templates'
  ],
  duration: 3600 // 1 hour
}));
```

### Monitor Request Latency

```bash
# Check slow queries
grep "Query took" /var/log/saas-agendamiento/app.log | sort -t: -k2 -nr | head -10
```

## Scaling Considerations

### Multi-Node Setup

For high traffic, consider:

1. **Load Balancer**: Nginx or AWS ALB
2. **Database Replication**: SQLite → PostgreSQL
3. **Session Storage**: Redis for distributed sessions
4. **Cache Layer**: Redis for template caching

### Migration to PostgreSQL

```bash
# Step 1: Export SQLite
sqlite3 /var/lib/saas-agendamiento/data/saas.db .dump > backup.sql

# Step 2: Convert to PostgreSQL syntax
# (Use migration tools like pgloader)

# Step 3: Update connection string
DB_URL=postgresql://user:pass@localhost/saas
```

## Troubleshooting

### Application Won't Start

```bash
# Check Node process
ps aux | grep node

# View PM2 logs
pm2 logs saas-agendamiento

# Check port availability
lsof -i :3001

# Verify environment variables
env | grep ENCRYPTION_KEY
```

### Database Locks

```bash
# Check for active connections
lsof /var/lib/saas-agendamiento/data/saas.db

# Close hung processes
pkill -f "node src/index.js"
pm2 restart saas-agendamiento
```

### Memory Issues

```bash
# Monitor memory usage
free -h

# Check Node memory
node -e "console.log(require('os').totalmem() / (1024 * 1024) + ' MB')"

# Set memory limit in PM2
pm2 start src/index.js --max-memory-restart 500M
```

## Post-Deployment Checklist

- [ ] Environment variables configured securely
- [ ] Database initialized and verified
- [ ] SSL/TLS certificates installed
- [ ] Backup system tested
- [ ] Monitoring and alerting configured
- [ ] Error tracking (Sentry) operational
- [ ] Load testing completed
- [ ] Disaster recovery plan documented
- [ ] Team trained on runbooks
- [ ] API health check responding
- [ ] Database backups automated
- [ ] Log rotation configured
- [ ] Performance metrics baseline established

## Additional Resources

- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [PM2 Documentation](https://pm2.keymetrics.io/docs)
