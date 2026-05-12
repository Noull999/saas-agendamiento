const jwt = require('jsonwebtoken');
const db = require('../db/database');

function authMiddleware(req, res, next) {
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

  // Verificar que el token no fue invalidado por logout
  const business = db.prepare('SELECT id, token_version FROM businesses WHERE id = ?').get(payload.id);
  if (!business) return res.status(401).json({ error: 'Token inválido o expirado' });

  const tokenVersion = payload.tv ?? 0;
  if (tokenVersion !== business.token_version) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }

  req.business = payload;
  next();
}

module.exports = authMiddleware;
