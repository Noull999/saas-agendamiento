const jwt = require('jsonwebtoken');
const db = require('../db/database');

async function authMiddleware(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  const token = header.slice(7);
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }

  try {
    const { rows } = await db.query(
      'SELECT id, token_version FROM businesses WHERE id = $1',
      [payload.id]
    );
    const business = rows[0];
    if (!business) return res.status(401).json({ error: 'Token inválido o expirado' });

    const tokenVersion = payload.tv ?? 0;
    if (tokenVersion !== business.token_version) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }

    req.business = payload;
    next();
  } catch (err) {
    console.error('[auth] DB error:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = authMiddleware;
