const { Router } = require('express');
const apiKeyAuth = require('../middleware/apiKeyAuth');
const bookingsCtrl = require('../controllers/bookings.controller');
const db = require('../db/database');

const router = Router();

// API documentation (no auth required)
router.get('/', (req, res) => {
  res.json({
    version: 'v1',
    description: 'Public API for external integrations',
    endpoints: [
      'GET  /api/v1/bookings?date=YYYY-MM-DD&status=confirmed&page=1&limit=50',
      'POST /api/v1/bookings  (create booking via API key)',
      'GET  /api/v1/slots?days=7&date=YYYY-MM-DD&service_id=1',
      'PATCH /api/v1/bookings/:id/status  (update booking status)',
    ],
    auth: 'X-API-Key header required',
  });
});

// List bookings
router.get('/bookings', apiKeyAuth, bookingsCtrl.list);

// Create booking (delegates to publicCreate using the business slug from the API key)
router.post('/bookings', apiKeyAuth, (req, res, next) => {
  req.params = req.params || {};
  req.params.slug = req.business.slug;
  bookingsCtrl.publicCreate(req, res, next);
});

// Update booking status
router.patch('/bookings/:id/status', apiKeyAuth, bookingsCtrl.updateStatus);

// Available slots — inline logic (same as public.routes /:slug/slots)
router.get('/slots', apiKeyAuth, async (req, res) => {
  try {
    const business = req.business;

    const days = Math.min(30, Math.max(1, parseInt(req.query.days) || 7));
    const startDate = req.query.date ? new Date(req.query.date + 'T00:00:00') : new Date();
    startDate.setHours(0, 0, 0, 0);

    const serviceId = req.query.service_id ? parseInt(req.query.service_id) : null;
    let stepMin = 30;
    if (serviceId && Number.isInteger(serviceId)) {
      const { rows: svcRows } = await db.query(
        'SELECT duration_min FROM services WHERE id = $1 AND business_id = $2',
        [serviceId, business.id]
      );
      if (svcRows[0]) stepMin = svcRows[0].duration_min;
    }

    const { rows: scheduleRows } = await db.query(
      'SELECT dow, slots FROM schedules WHERE business_id = $1',
      [business.id]
    );

    const scheduleMap = {};
    scheduleRows.forEach(r => {
      try {
        const parsed = JSON.parse(r.slots);
        scheduleMap[r.dow] = Array.isArray(parsed) ? parsed : [];
      } catch {
        scheduleMap[r.dow] = [];
      }
    });

    function expandRange(start, end, step) {
      const slots = [];
      const [sh, sm] = start.split(':').map(Number);
      const [eh, em] = end.split(':').map(Number);
      let cur = sh * 60 + sm;
      const endMins = eh * 60 + em;
      while (cur < endMins) {
        const h = Math.floor(cur / 60);
        const m = cur % 60;
        slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
        cur += step;
      }
      return slots;
    }

    const result = [];

    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const dow = d.getDay();
      const ranges = scheduleMap[dow] || [];
      if (!ranges.length) continue;

      const dateStr = d.toISOString().slice(0, 10);

      const { rows: bookedRows } = await db.query(`
        SELECT SUBSTRING(datetime_iso FROM 12 FOR 5) as t FROM bookings
        WHERE business_id = $1 AND LEFT(datetime_iso, 10) = $2 AND status != 'cancelled'
      `, [business.id, dateStr]);
      const booked = bookedRows.map(r => r.t);

      const allTimes = ranges.flatMap(r => expandRange(r.start, r.end, stepMin));
      const available = allTimes.filter(t => !booked.includes(t));
      if (!available.length) continue;

      result.push({ date: dateStr, dow, slots: available });
    }

    res.json(result);
  } catch (err) {
    console.error('[v1/slots] error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
