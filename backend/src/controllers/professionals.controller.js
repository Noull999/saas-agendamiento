const db = require('../db/database');

const getOne = async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM professionals WHERE id = $1 AND business_id = $2 AND active = 1',
      [req.params.id, req.business.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Profesional no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[professionals] getOne error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const list = async (req, res) => {
  const { location_id } = req.query;
  try {
    let query = 'SELECT * FROM professionals WHERE business_id = $1 AND active = 1';
    const params = [req.business.id];
    if (location_id) {
      query += ' AND location_id = $2';
      params.push(location_id);
    }
    query += ' ORDER BY name ASC';
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('[professionals] list error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const create = async (req, res) => {
  const { name, specialty, email, commission_pct, commission_fixed, location_id } = req.body;
  if (!name || !specialty) return res.status(400).json({ error: 'name y specialty son requeridos' });

  const pct = parseFloat(commission_pct) || 0;
  const fixed = parseFloat(commission_fixed) || 0;
  if (pct < 0 || pct > 100) return res.status(400).json({ error: 'commission_pct debe estar entre 0 y 100' });
  if (fixed < 0) return res.status(400).json({ error: 'commission_fixed no puede ser negativo' });

  // Check plan limit
  const PLAN_LIMITS = { basic: 1, pro: 5, business: Infinity };
  const limit = PLAN_LIMITS[req.business.plan] ?? 1;
  if (limit !== Infinity) {
    const { rows: countRows } = await db.query(
      'SELECT COUNT(*) as n FROM professionals WHERE business_id = $1 AND active = 1',
      [req.business.id]
    );
    if (parseInt(countRows[0].n) >= limit) {
      return res.status(403).json({
        error: `Tu plan ${req.business.plan} permite máximo ${limit} profesional(es). Actualiza para agregar más.`,
        requiredPlan: limit === 1 ? 'pro' : 'business',
        currentPlan: req.business.plan,
      });
    }
  }
  // Validate location_id if provided
  let safeLocationId = null;
  if (location_id) {
    const { rows: locRows } = await db.query(
      'SELECT id FROM locations WHERE id = $1 AND business_id = $2',
      [location_id, req.business.id]
    );
    if (!locRows[0]) return res.status(404).json({ error: 'Sucursal no encontrada' });
    safeLocationId = locRows[0].id;
  }

  try {
    const { rows } = await db.query(
      'INSERT INTO professionals (business_id, name, specialty, email, commission_pct, commission_fixed, location_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [req.business.id, name.trim(), specialty.trim(), email || null, pct, fixed, safeLocationId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[professionals] create error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const update = async (req, res) => {
  try {
    const { rows: existing } = await db.query(
      'SELECT * FROM professionals WHERE id = $1 AND business_id = $2 AND active = 1',
      [req.params.id, req.business.id]
    );
    const prof = existing[0];
    if (!prof) return res.status(404).json({ error: 'Profesional no encontrado' });

    const { name, specialty, email, commission_pct, commission_fixed, location_id } = req.body;

    const pct = commission_pct !== undefined ? parseFloat(commission_pct) : prof.commission_pct;
    const fixed = commission_fixed !== undefined ? parseFloat(commission_fixed) : prof.commission_fixed;

    if (pct < 0 || pct > 100) return res.status(400).json({ error: 'commission_pct debe estar entre 0 y 100' });
    if (fixed < 0) return res.status(400).json({ error: 'commission_fixed no puede ser negativo' });

    // Validate location_id if provided
    let safeLocationId = prof.location_id;
    if (location_id !== undefined) {
      if (location_id === null) {
        safeLocationId = null;
      } else {
        const { rows: locRows } = await db.query(
          'SELECT id FROM locations WHERE id = $1 AND business_id = $2',
          [location_id, req.business.id]
        );
        if (!locRows[0]) return res.status(404).json({ error: 'Sucursal no encontrada' });
        safeLocationId = locRows[0].id;
      }
    }

    await db.query(
      'UPDATE professionals SET name = $1, specialty = $2, email = $3, commission_pct = $4, commission_fixed = $5, location_id = $6 WHERE id = $7',
      [
        name !== undefined ? name.trim() : prof.name,
        specialty !== undefined ? specialty.trim() : prof.specialty,
        email !== undefined ? email : prof.email,
        pct,
        fixed,
        safeLocationId,
        prof.id,
      ]
    );

    const { rows: updated } = await db.query('SELECT * FROM professionals WHERE id = $1', [prof.id]);
    res.json(updated[0]);
  } catch (err) {
    console.error('[professionals] update error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const remove = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT id FROM professionals WHERE id = $1 AND business_id = $2', [req.params.id, req.business.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Profesional no encontrado' });
    await db.query('UPDATE professionals SET active = 0 WHERE id = $1', [rows[0].id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[professionals] remove error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getOne, list, create, update, remove };
