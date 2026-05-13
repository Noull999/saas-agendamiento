const db = require('../db/database');

const getSummary = (req, res) => {
  const { from, to } = req.query;
  const id = req.business.id;

  const fromDate = from || new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  const toDate = to || new Date().toISOString().slice(0, 10);

  const totals = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
      SUM(CASE WHEN status = 'no_show'   THEN 1 ELSE 0 END) as no_show
    FROM bookings
    WHERE business_id = ? AND date(datetime_iso) BETWEEN ? AND ?
  `).get(id, fromDate, toDate);

  const byDay = db.prepare(`
    SELECT date(datetime_iso) as day, COUNT(*) as count
    FROM bookings
    WHERE business_id = ? AND date(datetime_iso) BETWEEN ? AND ?
    GROUP BY day ORDER BY day ASC
  `).all(id, fromDate, toDate);

  const byService = db.prepare(`
    SELECT s.name, COUNT(*) as count
    FROM bookings b
    JOIN services s ON s.id = b.service_id
    WHERE b.business_id = ? AND date(b.datetime_iso) BETWEEN ? AND ?
    GROUP BY s.id ORDER BY count DESC
    LIMIT 5
  `).all(id, fromDate, toDate);

  const revenueRow = db.prepare(`
    SELECT COALESCE(SUM(s.price), 0) as revenue
    FROM bookings b
    JOIN services s ON s.id = b.service_id
    WHERE b.business_id = ?
      AND date(b.datetime_iso) BETWEEN ? AND ?
      AND b.status IN ('confirmed', 'completed')
  `).get(id, fromDate, toDate);

  res.json({ totals, byDay, byService, revenue: revenueRow.revenue, from: fromDate, to: toDate });
};

module.exports = { getSummary };
