const pool = require('../db/database');

const getSummary = async (req, res) => {
  try {
    const { from, to } = req.query;
    const id = req.business.id;

    const fromDate = from || new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
    const toDate = to || new Date().toISOString().slice(0, 10);

    const totalsResult = await pool.query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN status = 'no_show'   THEN 1 ELSE 0 END) as no_show
      FROM bookings
      WHERE business_id = $1 AND DATE(datetime_iso AT TIME ZONE 'UTC') BETWEEN $2 AND $3
    `, [id, fromDate, toDate]);

    const byDayResult = await pool.query(`
      SELECT DATE(datetime_iso AT TIME ZONE 'UTC') as day, COUNT(*) as count
      FROM bookings
      WHERE business_id = $1 AND DATE(datetime_iso AT TIME ZONE 'UTC') BETWEEN $2 AND $3
      GROUP BY day ORDER BY day ASC
    `, [id, fromDate, toDate]);

    const byServiceResult = await pool.query(`
      SELECT s.name, COUNT(*) as count
      FROM bookings b
      JOIN services s ON s.id = b.service_id
      WHERE b.business_id = $1 AND DATE(b.datetime_iso AT TIME ZONE 'UTC') BETWEEN $2 AND $3
      GROUP BY s.id ORDER BY count DESC
      LIMIT 5
    `, [id, fromDate, toDate]);

    const revenueResult = await pool.query(`
      SELECT COALESCE(SUM(s.price), 0) as revenue
      FROM bookings b
      JOIN services s ON s.id = b.service_id
      WHERE b.business_id = $1
        AND DATE(b.datetime_iso AT TIME ZONE 'UTC') BETWEEN $2 AND $3
        AND b.status IN ('confirmed', 'completed')
    `, [id, fromDate, toDate]);

    res.json({
      totals: totalsResult.rows[0],
      byDay: byDayResult.rows,
      byService: byServiceResult.rows,
      revenue: revenueResult.rows[0].revenue,
      from: fromDate,
      to: toDate
    });
  } catch (err) {
    console.error('[analytics] GetSummary error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getSummary };
