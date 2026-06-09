const db = require('../db/database');

const getSummary = async (req, res) => {
  const { from, to } = req.query;
  const id = req.business.id;

  const fromDate = from || new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  const toDate = to || new Date().toISOString().slice(0, 10);

  // Compute previous period range (same length, one period back)
  const rangeMs = new Date(toDate) - new Date(fromDate);
  const prevTo = new Date(new Date(fromDate) - 86400000).toISOString().slice(0, 10);
  const prevFrom = new Date(new Date(prevTo) - rangeMs).toISOString().slice(0, 10);

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

    // Previous period: same queries for prevFrom..prevTo
    const { rows: prevTotalsRows } = await db.query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN status = 'no_show'   THEN 1 ELSE 0 END) as no_show
      FROM bookings
      WHERE business_id = $1 AND LEFT(datetime_iso, 10) BETWEEN $2 AND $3
    `, [id, prevFrom, prevTo]);

    const { rows: prevRevenueRows } = await db.query(`
      SELECT COALESCE(SUM(s.price), 0) as revenue
      FROM bookings b
      JOIN services s ON s.id = b.service_id
      WHERE b.business_id = $1
        AND LEFT(b.datetime_iso, 10) BETWEEN $2 AND $3
        AND b.status IN ('confirmed', 'completed')
    `, [id, prevFrom, prevTo]);

    // Cancellation rate
    const totals = totalsRows[0];
    const total = parseInt(totals.total) || 0;
    const cancelled = (parseInt(totals.cancelled) || 0) + (parseInt(totals.no_show) || 0);
    const cancellationRate = total ? parseFloat(((cancelled / total) * 100).toFixed(1)) : 0;

    // Peak hours — top 6 hours by booking count
    const { rows: peakHours } = await db.query(`
      SELECT SUBSTRING(datetime_iso, 12, 2) as hour, COUNT(*) as count
      FROM bookings
      WHERE business_id = $1 AND LEFT(datetime_iso, 10) BETWEEN $2 AND $3
      GROUP BY hour ORDER BY count DESC LIMIT 6
    `, [id, fromDate, toDate]);

    // New vs returning clients
    const { rows: newVsReturningRows } = await db.query(`
      SELECT
        SUM(CASE WHEN booking_count = 1 THEN 1 ELSE 0 END) as new_clients,
        SUM(CASE WHEN booking_count > 1  THEN 1 ELSE 0 END) as returning_clients
      FROM (
        SELECT client_name, COUNT(*) as booking_count
        FROM bookings
        WHERE business_id = $1 AND LEFT(datetime_iso, 10) BETWEEN $2 AND $3
        GROUP BY client_name
      ) sub
    `, [id, fromDate, toDate]);

    res.json({
      totals,
      byDay,
      byService,
      revenue: revenueRows[0].revenue,
      from: fromDate,
      to: toDate,
      prevRevenue: prevRevenueRows[0].revenue,
      prevTotals: prevTotalsRows[0],
      cancellationRate,
      peakHours,
      newVsReturning: newVsReturningRows[0],
    });
  } catch (err) {
    console.error('[analytics] getSummary error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const getCommissions = async (req, res) => {
  const { from, to } = req.query;
  const fromDate = from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const toDate = to || new Date().toISOString().slice(0, 10);

  try {
    const { rows } = await db.query(`
      SELECT
        pr.id,
        pr.name AS professional_name,
        pr.commission_pct,
        pr.commission_fixed,
        COUNT(c.id) AS total_consultations,
        COALESCE(SUM(s.price), 0) AS total_revenue,
        COALESCE(
          SUM(
            CASE
              WHEN pr.commission_pct > 0 THEN (s.price * pr.commission_pct / 100)
              WHEN pr.commission_fixed > 0 THEN pr.commission_fixed
              ELSE 0
            END
          ), 0
        ) AS total_commission
      FROM professionals pr
      LEFT JOIN consultations c ON c.professional_id = pr.id
        AND LEFT(c.created_at::text, 10) >= $2
        AND LEFT(c.created_at::text, 10) <= $3
      LEFT JOIN bookings b ON c.booking_id = b.id
      LEFT JOIN services s ON b.service_id = s.id
      WHERE pr.business_id = $1 AND pr.active = 1
      GROUP BY pr.id, pr.name, pr.commission_pct, pr.commission_fixed
      ORDER BY total_commission DESC
    `, [req.business.id, fromDate, toDate]);

    res.json(rows);
  } catch (err) {
    console.error('[analytics] getCommissions error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getSummary, getCommissions };
