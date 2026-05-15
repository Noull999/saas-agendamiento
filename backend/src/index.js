require('dotenv').config();

function validateSecret(name, minLength = 32) {
  const value = process.env[name];
  if (!value) {
    console.error(`[FATAL] ${name} no configurada. Usa: openssl rand -hex 32`);
    process.exit(1);
  }
  if (value.length < minLength) {
    console.error(`[FATAL] ${name} debe tener mínimo ${minLength} caracteres`);
    process.exit(1);
  }
  if (value.includes('CHANGE_ME') || value === 'example') {
    console.error(`[FATAL] ${name} aún contiene valor de ejemplo. Configura un valor real`);
    process.exit(1);
  }
}

validateSecret('JWT_SECRET', 32);
validateSecret('ENCRYPTION_KEY', 32);

console.log('[STARTUP] Secretos validados correctamente');

// Initialize Sentry for error tracking in production
if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
  const Sentry = require('@sentry/node');
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1, // 10% de requests
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.OnUncaughtException(),
      new Sentry.Integrations.OnUnhandledRejection(),
    ],
  });
}

// Initialize PostgreSQL connection pool
const pool = require('./db/database');

const express = require('express');
const { startReminderJob } = require('./jobs/reminders');
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

// Sentry request handler (si está configurado en production)
if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
  const Sentry = require('@sentry/node');
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());
}

// Redirigir HTTP → HTTPS en producción
if (!isDev) {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] === 'http') {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

// CORS: solo permite el frontend local en dev, o el dominio configurado en prod
const allowedOrigins = isDev
  ? ['http://localhost:5173', 'http://localhost:4173']
  : (process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []);

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
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

// Rate limiting estricto para cancel endpoint (previene enumeration de tokens)
const cancelLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 1, // 1 intento por IP
  skip: () => isDev,
  message: { error: 'Demasiados intentos de cancelación. Intenta en 5 minutos' },
});

// Rate limiting para portal de pacientes (previene brute force de teléfonos)
const patientPortalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // 10 búsquedas por teléfono/slug
  skip: () => isDev,
  keyGenerator: (req) => `${req.params.slug}:${req.query.phone}`, // Por slug+phone
  message: { error: 'Demasiadas búsquedas. Intenta en 15 minutos' },
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);
app.use('/api/bookings/public', bookingLimiter);
app.use('/api/public/cancel', cancelLimiter);
app.use('/api/public/:slug/mis-citas', patientPortalLimiter);

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

app.get('/health', (_, res) => res.json({ ok: true }));

// Sentry error handler (si está configurado en production)
if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
  const Sentry = require('@sentry/node');
  app.use(Sentry.Handlers.errorHandler());
}

// Error handler — nunca expone detalles internos al cliente
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`[API] Servidor corriendo en http://localhost:${PORT}`);
  startReminderJob();
});
