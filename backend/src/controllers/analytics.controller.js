const db = require('../db/database');

const getSummary = async (req, res) => {
  const { from, to } = req.query;
  const id = req.business.id;

  const fromDate = from || new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  const toDate = to || new Date().toISOString().slice(0, 10);

  try {
    const { rows: totalsRows } = await db.query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN status = 'no_show'   THEN 1 ELSE 0 END) as no_show
      FROM bookings
      WHERE business_id = $1 AND LEFT(datetime_iso, 10) BETWEEN $2 AND $3
    `, [id, fromDate, toDate]);

    const { rows: byDay } = await db.query(`
      SELECT LEFT(datetime_iso, 10) as day, COUNT(*) as count
      FROM bookings
      WHERE business_id = $1 AND LEFT(datetime_iso, 10) BETWEEN $2 AND $3
      GROUP BY day ORDER BY day ASC
    `, [id, fromDate, toDate]);

    const { rows: byService } = await db.query(`
      SELECT s.name, COUNT(*) as count
      FROM bookings b
      JOIN services s ON s.id = b.service_id
      WHERE b.business_id = $1 AND LEFT(b.datetime_iso, 10) BETWEEN $2 AND $3
      GROUP BY s.id, s.name ORDER BY count DESC
      LIMIT 5
    `, [id, fromDate, toDate]);

    const { rows: revenueRows } = await db.query(`
      SELECT COALESCE(SUM(s.price), 0) as revenue
      FROM bookings b
      JOIN services s ON s.id = b.service_id
      WHERE b.business_id = $1
        AND LEFT(b.datetime_iso, 10) BETWEEN $2 AND $3
        AND b.status IN ('confirmed', 'completed')
    `, [id, fromDate, toDate]);

    const totals = totalsRows[0];
    res.json({ totals, byDay, byService, revenue: revenueRows[0].revenue, from: fromDate, to: toDate });
  } catch (err) {
    console.error('[analytics] getSummary error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getSummary };
