require('dotenv').config();

if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length < 32) {
  console.error('[FATAL] ENCRYPTION_KEY no configurada o muy corta (mínimo 32 caracteres)');
  process.exit(1);
}

// JWT_SECRET es la base de toda la autenticación: exigir longitud mínima.
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('[FATAL] JWT_SECRET no configurada o muy corta (mínimo 32 caracteres)');
  process.exit(1);
}

require('./db/database');

const express = require('express');
const { startReminderJob, stopReminderJob } = require('./jobs/reminders');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;
// Fail-safe: solo activar modo dev cuando se pide explícitamente.
// Si NODE_ENV no está seteado, asumimos producción (no relajar rate limits).
const isDev = process.env.NODE_ENV === 'development';

// Confiar en el proxy inverso (Nginx/Caddy) para leer X-Forwarded-Proto e IP real
if (!isDev) app.set('trust proxy', 1);

// Security headers
app.use(helmet());

// Redirigir HTTP → HTTPS en producción
if (!isDev) {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] === 'http') {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

// CORS: en dev permite Vite dev server; en prod el frontend se sirve desde este mismo servidor
const allowedOrigins = isDev
  ? ['http://localhost:5173', 'http://localhost:4173']
  : (process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []);

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  credentials: false,
}));

// El webhook de Stripe necesita el body en crudo (Buffer), no parseado.
// Se registra ANTES de express.json() para que no lo intercepte.
app.post(
  '/api/billing/webhook',
  express.raw({ type: 'application/json' }),
  require('./controllers/billing.controller').webhook
);

// Limit request body size (prevent DoS via huge payloads)
app.use(express.json({ limit: '50kb' }));

// Rate limiting global
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes, intenta en 15 minutos' },
}));

// Rate limiting estricto para auth (previene fuerza bruta)
// En desarrollo se omite para no bloquear el flujo de trabajo
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skip: () => isDev,
  message: { error: 'Demasiados intentos de autenticación, intenta en 15 minutos' },
});

// Rate limiting para endpoint público de reservas
const bookingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  skip: () => isDev,
  message: { error: 'Demasiadas reservas en poco tiempo, intenta en 1 minuto' },
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);
app.use('/api/bookings/public', bookingLimiter);

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/services', require('./routes/services.routes'));
app.use('/api/schedules', require('./routes/schedules.routes'));
app.use('/api/bookings', require('./routes/bookings.routes'));
app.use('/api/public', require('./routes/public.routes'));
app.use('/api/settings', require('./routes/settings.routes'));
app.use('/api/analytics', require('./routes/analytics.routes'));
app.use('/api/patients', require('./routes/patients.routes'));
app.use('/api/consultations', require('./routes/consultations.routes'));
app.use('/api/prescriptions', require('./routes/prescriptions.routes'));
app.use('/api/professionals', require('./routes/professionals.routes'));
// billing incluye el webhook de Stripe (raw body) y el checkout protegido
app.use('/api/billing', require('./routes/billing.routes'));
app.use('/api/locations', require('./routes/locations.routes'));
app.use('/api/reports', require('./routes/reports.routes'));
app.use('/api/payments', require('./routes/payments.routes'));
app.use('/api/integrations', require('./routes/integrations.routes'));
app.use('/api/v1', require('./routes/v1.routes'));
app.use('/api/api-keys', require('./routes/apiKeys.routes'));

app.get('/health', async (req, res) => {
  try {
    await require('./db/database').query('SELECT 1');
    res.json({ ok: true, db: 'up', uptime: Math.round(process.uptime()) });
  } catch (err) {
    console.error('[health] DB check failed:', err.message);
    res.status(503).json({ ok: false, db: 'down', error: err.message });
  }
});

// Servir el frontend compilado (en producción)
const path = require('path');
const fs = require('fs');
// Railway copia solo el directorio raíz del servicio (backend/) al contenedor.
// El frontend compilado vive en backend/public/ para garantizar que esté disponible.
const DIST = path.join(__dirname, '../public');
if (fs.existsSync(DIST)) {
  // Archivos con hash (JS/CSS) → cache largo, son inmutables
  app.use('/assets', express.static(path.join(DIST, 'assets'), {
    maxAge: '1y',
    immutable: true,
  }));
  // Otros estáticos (favicon, etc.) sin cache agresivo
  app.use(express.static(DIST, { maxAge: 0 }));
  // SPA fallback: cualquier ruta que no sea /api/* devuelve index.html
  // index.html NUNCA debe cachearse — apunta a los assets con hash actualizados
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Ruta no encontrada' });
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(DIST, 'index.html'));
  });
  console.log('[API] Frontend estático habilitado desde', DIST);
}

app.get('/health/ready', async (_, res) => {
  try {
    await require('./db/database').query('SELECT 1');
    res.json({ ok: true, db: 'connected' });
  } catch {
    res.status(503).json({ ok: false, db: 'unreachable' });
  }
});

// Error handler — nunca expone detalles internos al cliente
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const server = app.listen(PORT, () => {
  console.log(`[API] Servidor corriendo en http://localhost:${PORT}`);
  startReminderJob();
});

function gracefulShutdown(signal) {
  console.log(`[API] ${signal} recibido, cerrando servidor...`);
  stopReminderJob();
  server.close(async () => {
    await require('./db/database').pool.end();
    console.log('[API] Servidor cerrado correctamente');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000);
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
