const jwt = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');
const { getTestDb } = require('./testDb');

const createTestBusiness = async (overrides = {}) => {
  const db = getTestDb();
  const defaults = {
    slug: 'test-business',
    name: 'Test Business',
    owner_email: 'owner@test.com',
    password_hash: await bcryptjs.hash('password123', 10),
    phone: '1234567890',
    plan: 'basic',
    template_id: 'modern_minimal',
    page_config: '{}',
    ...overrides
  };

  const stmt = db.prepare(`
    INSERT INTO businesses (slug, name, owner_email, password_hash, phone, plan, template_id, page_config)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    defaults.slug,
    defaults.name,
    defaults.owner_email,
    defaults.password_hash,
    defaults.phone || null,
    defaults.plan,
    defaults.template_id,
    typeof defaults.page_config === 'object' ? JSON.stringify(defaults.page_config) : defaults.page_config
  );

  return db.prepare('SELECT * FROM businesses WHERE slug = ?').get(defaults.slug);
};

const createTestService = (businessId, overrides = {}) => {
  const db = getTestDb();
  const defaults = {
    business_id: businessId,
    name: 'Test Service',
    description: 'Test service description',
    duration_min: 60,
    price: 50,
    active: 1,
    ...overrides
  };

  if (!defaults.business_id) {
    throw new Error('business_id is required');
  }

  const stmt = db.prepare(`
    INSERT INTO services (business_id, name, description, duration_min, price, active)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    defaults.business_id,
    defaults.name,
    defaults.description || null,
    defaults.duration_min,
    defaults.price || null,
    defaults.active
  );

  const services = db.prepare('SELECT * FROM services WHERE business_id = ? ORDER BY id DESC LIMIT 1').all(businessId);
  return services.length > 0 ? services[0] : null;
};

const createTestToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET || 'test-secret-key');
};

const createTestBooking = (businessId, serviceId = null, overrides = {}) => {
  const db = getTestDb();
  const defaults = {
    business_id: businessId,
    service_id: serviceId || null,
    client_name: 'Test Client',
    client_email: 'client@test.com',
    client_phone: '9999999999',
    datetime_iso: new Date().toISOString(),
    status: 'confirmed',
    source: 'web',
    ...overrides
  };

  if (!defaults.business_id) {
    throw new Error('business_id is required');
  }

  const stmt = db.prepare(`
    INSERT INTO bookings (business_id, service_id, client_name, client_email, client_phone, datetime_iso, status, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    defaults.business_id,
    defaults.service_id,
    defaults.client_name || 'Test Client',
    defaults.client_email || null,
    defaults.client_phone || null,
    defaults.datetime_iso || new Date().toISOString(),
    defaults.status,
    defaults.source
  );

  const bookings = db.prepare('SELECT * FROM bookings WHERE business_id = ? ORDER BY id DESC LIMIT 1').all(businessId);
  return bookings.length > 0 ? bookings[0] : null;
};

const createTestSchedule = (businessId, dow, slots) => {
  const db = getTestDb();
  const stmt = db.prepare(`
    INSERT INTO schedules (business_id, dow, slots)
    VALUES (?, ?, ?)
  `);

  stmt.run(businessId, dow, JSON.stringify(slots));
  return db.prepare('SELECT * FROM schedules WHERE business_id = ? AND dow = ?').get(businessId, dow);
};

module.exports = {
  createTestBusiness,
  createTestService,
  createTestToken,
  createTestBooking,
  createTestSchedule
};
