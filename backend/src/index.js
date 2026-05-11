require('dotenv').config();

if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length < 32) {
  console.error('[FATAL] ENCRYPTION_KEY no configurada o muy corta (mínimo 32 caracteres)');
  process.exit(1);
}

require('./db/database');

const express = require('express');
const compression = require('compression');
const { startReminderJob } = require('./jobs/reminders');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;
const isDev = process.env.NODE_ENV !== 'production';

// Security headers
app.use(helmet());

// Compression middleware - reduce response size
app.use(compression());

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

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/bookings/public', bookingLimiter);

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/services', require('./routes/services.routes'));
app.use('/api/schedules', require('./routes/schedules.routes'));
app.use('/api/bookings', require('./routes/bookings.routes'));
app.use('/api/public', require('./routes/public.routes'));
app.use('/api/settings', require('./routes/settings.routes'));
app.use('/api/analytics', require('./routes/analytics.routes'));
app.use('/api/page-builder', require('./routes/page-builder.routes'));
app.use('/api/patients', require('./routes/patients.routes'));
app.use('/api/consultations', require('./routes/consultations.routes'));
app.use('/api/prescriptions', require('./routes/prescriptions.routes'));
app.use('/api/professionals', require('./routes/professionals.routes'));
// billing incluye el webhook de Stripe (raw body) y el checkout protegido
app.use('/api/billing', require('./routes/billing.routes'));

app.get('/health', (_, res) => res.json({ ok: true }));

// Error handler — nunca expone detalles internos al cliente
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`[API] Servidor corriendo en http://localhost:${PORT}`);
  startReminderJob();
});
