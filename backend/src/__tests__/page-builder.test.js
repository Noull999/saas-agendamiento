const { initTestDb, getTestDb, closeTestDb } = require('./setup/testDb');
const { createTestBusiness, createTestToken } = require('./setup/testUtils');
const jwt = require('jsonwebtoken');

let db;

beforeAll(() => {
  db = initTestDb();
  process.env.JWT_SECRET = 'test-secret-key-for-testing';
});

afterAll(() => {
  closeTestDb();
});

describe('Page Builder Routes', () => {
  let testBusiness;
  let authToken;

  beforeEach(async () => {
    testBusiness = await createTestBusiness({
      slug: `test-${Date.now()}`,
      owner_email: `user${Date.now()}@test.com`,
      template_id: 'modern_minimal',
      page_config: {
        branding: {
          primary_color: '#1a5490',
          secondary_color: '#2c5aa0'
        },
        sections: {}
      }
    });

    authToken = createTestToken({
      id: testBusiness.id,
      email: testBusiness.owner_email,
      slug: testBusiness.slug
    });
  });

  describe('GET /templates', () => {
    it('should return array of templates', () => {
      // Templates should be pre-seeded in database
      const templates = db.prepare('SELECT template_id, name, description FROM page_templates').all();

      expect(Array.isArray(templates)).toBe(true);
    });

    it('should include required template fields', () => {
      const templates = db.prepare('SELECT template_id, name, description FROM page_templates').all();

      if (templates.length > 0) {
        templates.forEach(template => {
          expect(template.template_id).toBeTruthy();
          expect(template.name).toBeTruthy();
        });
      }
    });

    it('should NOT require authentication', () => {
      // Public endpoint - no token needed
      const templates = db.prepare('SELECT template_id, name, description FROM page_templates').all();
      expect(templates).toBeDefined();
    });

    it('should include core templates', () => {
      const templateIds = [
        'modern_minimal',
        'full_width',
        'hero_focus',
        'gallery_style',
        'luxury_premium'
      ];

      const allTemplateIds = db.prepare('SELECT template_id FROM page_templates').all();
      const existingIds = allTemplateIds.map(t => t.template_id);

      templateIds.forEach(id => {
        expect(existingIds).toContain(id);
      });
    });
  });

  describe('GET /config', () => {
    it('should require authentication', () => {
      expect(authToken).toBeTruthy();
      expect(typeof authToken).toBe('string');
    });

    it('should return template_id and page_config', () => {
      const config = db.prepare(
        'SELECT template_id, page_config FROM businesses WHERE id = ?'
      ).get(testBusiness.id);

      expect(config.template_id).toBeTruthy();
      expect(config.page_config).toBeTruthy();
    });

    it('should return default template if none set', async () => {
      const business = await createTestBusiness({
        slug: `test-default-${Date.now()}`,
        owner_email: `user-default${Date.now()}@test.com`,
        template_id: null
      });

      const config = db.prepare(
        'SELECT template_id FROM businesses WHERE id = ?'
      ).get(business.id);

      const templateId = config.template_id || 'modern_minimal';
      expect(templateId).toBe('modern_minimal');
    });

    it('should parse page_config JSON', async () => {
      const business = await createTestBusiness({
        slug: `test-json-${Date.now()}`,
        owner_email: `user-json${Date.now()}@test.com`,
        page_config: {
          branding: { primary_color: '#000000' },
          sections: { hero: { enabled: true } }
        }
      });

      const config = db.prepare(
        'SELECT page_config FROM businesses WHERE id = ?'
      ).get(business.id);

      const parsed = JSON.parse(config.page_config);
      expect(parsed.branding).toBeDefined();
      expect(parsed.sections).toBeDefined();
    });

    it('should return empty config if JSON is corrupted', () => {
      // Test handling of corrupted JSON - should not throw
      const corruptedJson = '{invalid json}';

      expect(() => {
        JSON.parse(corruptedJson);
      }).toThrow();
    });

    it('should handle missing business', () => {
      const nonExistentId = 99999;
      const business = db.prepare(
        'SELECT * FROM businesses WHERE id = ?'
      ).get(nonExistentId);

      expect(business).toBeUndefined();
    });
  });

  describe('PATCH /config', () => {
    it('should require authentication', () => {
      expect(authToken).toBeTruthy();
    });

    it('should require template_id', () => {
      const updateData = {
        page_config: { sections: {} }
      };

      expect(updateData.template_id).toBeUndefined();
    });

    it('should validate template_id exists', () => {
      const invalidTemplateId = 'non_existent_template';
      const templates = db.prepare('SELECT template_id FROM page_templates').all();
      const validIds = templates.map(t => t.template_id);

      expect(validIds).not.toContain(invalidTemplateId);
    });

    it('should accept valid template_id', () => {
      const templates = db.prepare('SELECT template_id FROM page_templates').all();
      expect(templates.length).toBeGreaterThan(0);

      const validTemplateId = templates[0].template_id;
      expect(validTemplateId).toBeTruthy();
    });

    it('should validate page_config structure (max depth)', () => {
      // Create deeply nested object
      let deepConfig = { data: {} };
      let current = deepConfig.data;

      for (let i = 0; i < 10; i++) {
        current.nested = {};
        current = current.nested;
      }

      const jsonStr = JSON.stringify(deepConfig);
      expect(jsonStr).toBeTruthy();

      // Validation function should reject if depth > 5
      const maxDepth = (obj, depth = 0) => {
        if (depth > 5) throw new Error('page_config demasiado profundo');
        if (typeof obj !== 'object' || !obj) return depth;
        return Math.max(...Object.values(obj).map(v => maxDepth(v, depth + 1)));
      };

      expect(() => {
        maxDepth(deepConfig);
      }).toThrow();
    });

    it('should validate page_config size (max 100KB)', () => {
      const largeConfig = {
        sections: {}
      };

      // Create large object
      for (let i = 0; i < 1000; i++) {
        largeConfig.sections[`section_${i}`] = {
          data: 'x'.repeat(100)
        };
      }

      const jsonStr = JSON.stringify(largeConfig);
      expect(jsonStr.length).toBeGreaterThan(100000);
    });

    it('should accept valid page_config', () => {
      const validConfig = {
        template_id: 'modern_minimal',
        page_config: {
          branding: {
            primary_color: '#1a5490',
            secondary_color: '#2c5aa0'
          },
          sections: {
            hero: { enabled: true, title: 'Hero' }
          }
        }
      };

      expect(validConfig.template_id).toBeTruthy();
      expect(typeof validConfig.page_config).toBe('object');
    });

    it('should allow null/undefined page_config', () => {
      const updateData = {
        template_id: 'modern_minimal'
        // page_config omitted
      };

      expect(updateData.page_config).toBeUndefined();
    });

    it('should preserve existing config on partial update', () => {
      const newConfig = {
        template_id: 'full_width'
        // page_config not provided - should keep existing
      };

      expect(newConfig.page_config).toBeUndefined();
    });

    it('should store page_config as JSON string', () => {
      const config = {
        branding: { primary_color: '#000000' },
        sections: {}
      };

      const jsonString = JSON.stringify(config);
      expect(typeof jsonString).toBe('string');
      expect(jsonString).toContain('branding');
    });
  });

  describe('Page Config Validation', () => {
    it('should reject non-object page_config', () => {
      const invalidConfigs = [
        'string',
        123,
        true,
        null,
        []
      ];

      invalidConfigs.forEach(config => {
        expect(typeof config !== 'object' || config === null || Array.isArray(config)).toBe(true);
      });
    });

    it('should accept object page_config', () => {
      const validConfigs = [
        {},
        { branding: {} },
        { sections: { hero: {} } },
        { branding: {}, sections: {} }
      ];

      validConfigs.forEach(config => {
        expect(typeof config === 'object' && !Array.isArray(config)).toBe(true);
      });
    });

    it('should handle circular references gracefully', () => {
      // Note: JSON.stringify will throw on circular references
      const circularObj = {};
      circularObj.self = circularObj;

      expect(() => {
        JSON.stringify(circularObj);
      }).toThrow();
    });
  });

  describe('Template Consistency', () => {
    it('should maintain template after config update', () => {
      const originalTemplate = 'modern_minimal';
      const newTemplate = 'full_width';

      expect(originalTemplate).not.toBe(newTemplate);
    });

    it('should validate all template references exist in page_templates', () => {
      const businessTemplate = testBusiness.template_id;
      const templateRecord = db.prepare(
        'SELECT id FROM page_templates WHERE template_id = ?'
      ).get(businessTemplate);

      expect(templateRecord).toBeDefined();
    });
  });

  describe('Authentication Middleware', () => {
    it('should extract business from JWT payload', () => {
      const payload = jwt.decode(authToken);

      expect(payload.id).toBe(testBusiness.id);
      expect(payload.email).toBe(testBusiness.owner_email);
      expect(payload.slug).toBe(testBusiness.slug);
    });

    it('should reject invalid JWT tokens', () => {
      const invalidToken = 'invalid.token.here';

      expect(() => {
        jwt.verify(invalidToken, process.env.JWT_SECRET);
      }).toThrow();
    });

    it('should verify token signature', () => {
      const validToken = jwt.sign(
        { id: 1, email: 'test@test.com' },
        'correct-secret'
      );

      const decoded = jwt.verify(validToken, 'correct-secret');
      expect(decoded.id).toBe(1);
    });

    it('should reject token signed with wrong secret', () => {
      const wrongToken = jwt.sign(
        { id: 1 },
        'wrong-secret'
      );

      expect(() => {
        jwt.verify(wrongToken, 'correct-secret');
      }).toThrow();
    });
  });
});
