const db = require('../db/database');

const SLUG_RE = /^[a-z0-9-]{3,60}$/;

const createLocation = async (req, res) => {
  const { name, address, phone, slug_suffix } = req.body;

  if (!name || name.trim().length < 2) {
    return res.status(400).json({ error: 'Nombre de la sucursal requerido (mín 2 chars)' });
  }

  if (!slug_suffix || !SLUG_RE.test(slug_suffix)) {
    return res.status(400).json({ error: 'slug_suffix requerido: solo letras minúsculas, números y guiones (3–60 chars)' });
  }

  try {
    const { rows: existing } = await db.query(
      'SELECT id FROM locations WHERE slug_suffix = $1',
      [slug_suffix]
    );
    if (existing.length) {
      return res.status(409).json({ error: 'Este slug ya está en uso' });
    }

    const { rows } = await db.query(
      `INSERT INTO locations (business_id, name, address, phone, slug_suffix)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.business.id, name.trim(), address?.trim() || null, phone?.trim() || null, slug_suffix]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[locations] createLocation error:', err.message);
    res.status(500).json({ error: 'Error creando sucursal' });
  }
};

const listLocations = async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM locations WHERE business_id = $1 ORDER BY name ASC',
      [req.business.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[locations] listLocations error:', err.message);
    res.status(500).json({ error: 'Error listando sucursales' });
  }
};

const updateLocation = async (req, res) => {
  const { id } = req.params;
  const { name, address, phone, active } = req.body;

  try {
    const { rows } = await db.query(
      `UPDATE locations
       SET name    = COALESCE($1, name),
           address = COALESCE($2, address),
           phone   = COALESCE($3, phone),
           active  = COALESCE($4, active)
       WHERE id = $5 AND business_id = $6
       RETURNING *`,
      [name ?? null, address ?? null, phone ?? null, active ?? null, id, req.business.id]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Sucursal no encontrada' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('[locations] updateLocation error:', err.message);
    res.status(500).json({ error: 'Error actualizando sucursal' });
  }
};

const deleteLocation = async (req, res) => {
  const { id } = req.params;

  try {
    // Verify ownership first
    const { rows: owned } = await db.query(
      'SELECT id FROM locations WHERE id = $1 AND business_id = $2',
      [id, req.business.id]
    );
    if (!owned[0]) {
      return res.status(404).json({ error: 'Sucursal no encontrada' });
    }

    // Check for active bookings or professionals
    const { rows: checks } = await db.query(
      `SELECT
         (SELECT COUNT(*) FROM bookings      WHERE location_id = $1) AS bookings,
         (SELECT COUNT(*) FROM professionals WHERE location_id = $1 AND active = 1) AS professionals`,
      [id]
    );

    if (parseInt(checks[0]?.bookings) > 0) {
      return res.status(400).json({ error: 'No se puede eliminar una sucursal con reservas asociadas' });
    }
    if (parseInt(checks[0]?.professionals) > 0) {
      return res.status(400).json({ error: 'No se puede eliminar una sucursal con profesionales activos' });
    }

    await db.query('DELETE FROM locations WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[locations] deleteLocation error:', err.message);
    res.status(500).json({ error: 'Error eliminando sucursal' });
  }
};

module.exports = { createLocation, listLocations, updateLocation, deleteLocation };
