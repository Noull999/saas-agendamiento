const db = require('../db/database');

function auditLog(businessId, action, resource, resourceId, ip) {
  try {
    db.prepare(
      'INSERT INTO audit_logs (business_id, action, resource, resource_id, ip) VALUES (?, ?, ?, ?, ?)'
    ).run(businessId, action, resource, resourceId ?? null, ip ?? null);
  } catch (_) {}
}

module.exports = { auditLog };
