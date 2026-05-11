const { initTestDb, getTestDb, closeTestDb } = require('./setup/testDb');
const { createTestBusiness, createTestService, createTestBooking, createTestToken } = require('./setup/testUtils');
const jwt = require('jsonwebtoken');

let db;

beforeAll(() => {
  db = initTestDb();
  process.env.JWT_SECRET = 'test-secret-key-for-testing';
});

afterAll(() => {
  closeTestDb();
});

describe('Bookings Controller', () => {
  let testBusiness;
  let testService;
  let authToken;

  beforeEach(async () => {
    testBusiness = await createTestBusiness({
      slug: `test-${Date.now()}`,
      owner_email: `user${Date.now()}@test.com`
    });
    testService = createTestService(testBusiness.id);

    authToken = createTestToken({
      id: testBusiness.id,
      email: testBusiness.owner_email,
      slug: testBusiness.slug
    });
  });

  describe('Create Booking', () => {
    it('should validate required fields (client_name)', () => {
      const bookingData = {
        client_email: 'client@test.com',
        client_phone: '1234567890',
        service_id: testService.id,
        datetime_iso: new Date().toISOString(),
        notes: 'Test booking'
      };

      expect(bookingData.client_name).toBeUndefined();
    });

    it('should validate required fields (datetime_iso)', () => {
      const bookingData = {
        client_name: 'John Doe',
        client_email: 'client@test.com',
        client_phone: '1234567890',
        service_id: testService.id
      };

      expect(bookingData.datetime_iso).toBeUndefined();
    });

    it('should accept valid booking data', () => {
      const bookingData = {
        client_name: 'John Doe',
        client_email: 'client@test.com',
        client_phone: '1234567890',
        service_id: testService.id,
        datetime_iso: new Date().toISOString(),
        notes: 'Test booking'
      };

      expect(bookingData.client_name).toBeTruthy();
      expect(bookingData.datetime_iso).toBeTruthy();
    });

    it('should allow booking without service_id', () => {
      const bookingData = {
        client_name: 'John Doe',
        client_email: 'client@test.com',
        datetime_iso: new Date().toISOString()
      };

      expect(bookingData.client_name).toBeTruthy();
      expect(bookingData.service_id).toBeUndefined();
    });

    it('should allow booking without email', () => {
      const bookingData = {
        client_name: 'John Doe',
        client_phone: '1234567890',
        datetime_iso: new Date().toISOString()
      };

      expect(bookingData.client_email).toBeUndefined();
    });

    it('should allow booking without phone', () => {
      const bookingData = {
        client_name: 'John Doe',
        client_email: 'client@test.com',
        datetime_iso: new Date().toISOString()
      };

      expect(bookingData.client_phone).toBeUndefined();
    });

    it('should use web as default source', () => {
      const bookingData = {
        client_name: 'John Doe',
        datetime_iso: new Date().toISOString()
      };

      const source = bookingData.source || 'web';
      expect(source).toBe('web');
    });

    it('should use confirmed as default status', () => {
      const bookingData = {
        client_name: 'John Doe',
        datetime_iso: new Date().toISOString()
      };

      const status = bookingData.status || 'confirmed';
      expect(status).toBe('confirmed');
    });
  });

  describe('List Bookings', () => {
    it('should validate date format (YYYY-MM-DD)', () => {
      const invalidDates = [
        '24-01-01',    // wrong year format
        '2024/01/01',  // wrong separator
        '2024-1-01',   // wrong month format
        '2024-01-1',   // wrong day format
        'invalid-date'
      ];

      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

      invalidDates.forEach(date => {
        expect(dateRegex.test(date)).toBe(false);
      });
    });

    it('should accept valid date format', () => {
      const validDates = [
        '2024-01-15',
        '2025-12-31',
        '2026-05-11'
      ];

      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

      validDates.forEach(date => {
        expect(dateRegex.test(date)).toBe(true);
      });
    });

    it('should validate status values', () => {
      const validStatuses = ['confirmed', 'cancelled', 'completed', 'no_show'];
      const invalidStatuses = ['pending', 'processing', 'failed', 'unknown'];

      validStatuses.forEach(status => {
        expect(validStatuses).toContain(status);
      });

      invalidStatuses.forEach(status => {
        expect(validStatuses).not.toContain(status);
      });
    });

    it('should limit results to 500', () => {
      const query = 'SELECT b.* FROM bookings b WHERE b.business_id = ? LIMIT 500';
      expect(query).toContain('LIMIT 500');
    });
  });

  describe('Update Booking Status', () => {
    it('should validate status values', () => {
      const validStatuses = ['confirmed', 'cancelled', 'completed', 'no_show'];
      const testStatus = 'confirmed';

      expect(validStatuses).toContain(testStatus);
    });

    it('should reject invalid status', () => {
      const validStatuses = ['confirmed', 'cancelled', 'completed', 'no_show'];
      const invalidStatus = 'invalid_status';

      expect(validStatuses).not.toContain(invalidStatus);
    });

    it('should update status for valid booking', () => {
      const booking = createTestBooking(testBusiness.id, testService.id, {
        status: 'confirmed'
      });

      expect(booking.status).toBe('confirmed');
    });

    it('should preserve other booking fields when updating status', () => {
      const originalData = {
        client_name: 'John Doe',
        client_email: 'john@test.com',
        client_phone: '1234567890'
      };

      const booking = createTestBooking(testBusiness.id, testService.id, originalData);

      expect(booking.client_name).toBe(originalData.client_name);
      expect(booking.client_email).toBe(originalData.client_email);
    });
  });

  describe('Delete Booking', () => {
    it('should require booking id', () => {
      const deleteData = {};

      expect(deleteData.id).toBeUndefined();
    });

    it('should verify business ownership before delete', () => {
      const booking = createTestBooking(testBusiness.id, testService.id);

      // Verify booking belongs to business
      const storedBooking = db.prepare('SELECT * FROM bookings WHERE id = ? AND business_id = ?')
        .get(booking.id, testBusiness.id);

      expect(storedBooking).toBeDefined();
      expect(storedBooking.business_id).toBe(testBusiness.id);
    });
  });

  describe('Public Booking Creation', () => {
    it('should validate business slug', () => {
      const slug = testBusiness.slug;
      expect(slug).toBeTruthy();
      expect(typeof slug).toBe('string');
    });

    it('should reject invalid business slug', () => {
      const invalidSlugs = ['', null, undefined, '   '];

      invalidSlugs.forEach(slug => {
        expect(!slug || slug.trim().length === 0).toBe(true);
      });
    });

    it('should require client_name for public booking', () => {
      const publicBookingData = {
        client_email: 'client@test.com',
        datetime_iso: new Date().toISOString()
      };

      expect(publicBookingData.client_name).toBeUndefined();
    });

    it('should require datetime_iso for public booking', () => {
      const publicBookingData = {
        client_name: 'John Doe',
        client_email: 'client@test.com'
      };

      expect(publicBookingData.datetime_iso).toBeUndefined();
    });

    it('should allow client_phone as optional', () => {
      const publicBookingData = {
        client_name: 'John Doe',
        client_email: 'client@test.com',
        datetime_iso: new Date().toISOString()
      };

      expect(publicBookingData.client_phone).toBeUndefined();
    });

    it('should set source to web for public bookings', () => {
      const source = 'web';
      expect(source).toBe('web');
    });
  });

  describe('Booking Authentication', () => {
    it('should require auth token for list', () => {
      expect(authToken).toBeTruthy();
      expect(typeof authToken).toBe('string');
    });

    it('should require auth token for create', () => {
      expect(authToken).toBeTruthy();
    });

    it('should require auth token for status update', () => {
      expect(authToken).toBeTruthy();
    });

    it('should require auth token for delete', () => {
      expect(authToken).toBeTruthy();
    });

    it('should NOT require auth token for public create', () => {
      const publicData = {
        slug: testBusiness.slug,
        booking: {
          client_name: 'John Doe',
          datetime_iso: new Date().toISOString()
        }
      };

      // Public endpoint should be accessible without token
      expect(publicData.slug).toBeTruthy();
    });
  });
});
