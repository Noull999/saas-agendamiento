const db = require('../db/database');

async function auditLog(businessId, action, resource, resourceId, ip) {
  try {
    await db.query(
      'INSERT INTO audit_logs (business_id, action, resource, resource_id, ip) VALUES ($1, $2, $3, $4, $5)',
      [businessId, action, resource, resourceId ?? null, ip ?? null]
    );
  } catch (_) {}
}

module.exports = { auditLog };
