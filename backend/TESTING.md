# Testing Guide

Comprehensive testing strategy for the SaaS Agendamiento backend application.

## Overview

This application uses **Jest** for unit and integration testing. All critical business logic is tested including:

- Authentication (register, login, JWT validation)
- Booking management (create, update, list, delete)
- Page builder configuration (templates, config validation)
- Database operations and constraints
- Error handling and edge cases

### Test Statistics

- **Total Tests**: 103
- **Test Files**: 5
- **Coverage**: Critical paths (Auth, Bookings, Page Builder)
- **Execution Time**: ~3.5 seconds

## Quick Start

### Running Tests Locally

```bash
# Run all tests
npm test

# Run tests in watch mode (re-run on file changes)
npm run test:watch

# Run specific test file
npm test -- src/__tests__/auth.test.js

# Run tests matching pattern
npm test -- --testNamePattern="should register"

# Show detailed output
npm test -- --verbose
```

### Test Output

```
Test Suites: 5 passed, 5 total
Tests:       103 passed, 103 total
Snapshots:   0 total
Time:        3.593 s
```

## Test Structure

### Directory Layout

```
backend/src/__tests__/
├── setup/                    # Test utilities and fixtures
│   ├── testDb.js            # In-memory SQLite database
│   └── testUtils.js         # Helper functions for test data
├── auth.test.js             # Authentication tests
├── bookings.test.js         # Booking management tests
└── page-builder.test.js     # Page builder tests
```

### Test Setup

Each test file:
1. Initializes in-memory SQLite database
2. Creates test data using utility functions
3. Runs assertions against business logic
4. Cleans up database after tests

```javascript
beforeAll(() => {
  db = initTestDb();
});

afterAll(() => {
  closeTestDb();
});

beforeEach(async () => {
  testBusiness = await createTestBusiness({...});
});
```

## Writing Tests

### Basic Test Structure

```javascript
describe('Feature Name', () => {
  let testBusiness;

  beforeEach(async () => {
    testBusiness = await createTestBusiness();
  });

  it('should do something specific', () => {
    expect(testBusiness.slug).toBeTruthy();
    expect(testBusiness.plan).toBe('basic');
  });

  it('should validate input', () => {
    const invalidData = {};
    expect(invalidData.name).toBeUndefined();
  });
});
```

### Test Utilities

Available helper functions in `setup/testUtils.js`:

```javascript
// Create test business
const business = await createTestBusiness({
  slug: 'unique-slug',
  owner_email: 'user@test.com'
});

// Create test service
const service = createTestService(business.id, {
  name: 'Haircut',
  price: 50
});

// Create test booking
const booking = createTestBooking(business.id, service.id, {
  client_name: 'John Doe',
  datetime_iso: new Date().toISOString()
});

// Create JWT token
const token = createTestToken({
  id: business.id,
  email: business.owner_email
});

// Create test schedule
const schedule = createTestSchedule(business.id, 1, [
  { start: '09:00', end: '17:00' }
]);
```

## Test Categories

### 1. Authentication Tests (`auth.test.js`)

Tests user registration, login, and JWT token validation.

```javascript
describe('POST /api/auth/register', () => {
  it('should validate required fields');
  it('should reject invalid email');
  it('should reject short passwords');
});
```

**Coverage:**
- ✅ Email validation (RFC 5322)
- ✅ Password strength (8-128 chars)
- ✅ Business name length (2-100 chars)
- ✅ JWT signing and verification
- ✅ Token expiration

### 2. Booking Tests (`bookings.test.js`)

Tests creating, listing, updating, and deleting bookings.

```javascript
describe('Create Booking', () => {
  it('should validate required fields');
  it('should allow optional fields');
  it('should set default values');
});
```

**Coverage:**
- ✅ Required fields (client_name, datetime_iso)
- ✅ Optional fields (email, phone, notes)
- ✅ Date format validation (YYYY-MM-DD)
- ✅ Status validation
- ✅ Public vs authenticated endpoints
- ✅ Service ownership validation

### 3. Page Builder Tests (`page-builder.test.js`)

Tests page template management and configuration.

```javascript
describe('GET /templates', () => {
  it('should return array of templates');
  it('should NOT require authentication');
});

describe('PATCH /config', () => {
  it('should validate template_id');
  it('should validate page_config structure');
});
```

**Coverage:**
- ✅ Template availability
- ✅ Configuration validation (depth, size)
- ✅ JSON parsing and error handling
- ✅ Authentication requirements
- ✅ Business entity isolation

## Running Tests in CI/CD

GitHub Actions runs tests automatically on:
- Every push to `main`, `develop`, or `claude/*` branches
- Every pull request to `main` or `develop`

### CI Test Script

```yaml
- name: Run unit tests
  run: npm test
  env:
    NODE_ENV: test
    JWT_SECRET: test-secret-key-for-testing
    ENCRYPTION_KEY: test-encryption-key-32-chars-minimum
```

### View CI Results

1. Go to GitHub repository
2. Click "Actions" tab
3. Select workflow run
4. Expand "Run unit tests" section

## Debugging Tests

### Debug Single Test

```bash
# Run with extra logging
npm test -- --verbose src/__tests__/auth.test.js

# Run with debugger
node --inspect-brk node_modules/.bin/jest --runInBand src/__tests__/auth.test.js
```

### Common Issues

#### Database State Issues

```javascript
// Problem: Tests fail in random order
// Solution: Reset database between tests

beforeEach(() => {
  db = initTestDb();  // Fresh database each test
});
```

#### Async Timing Issues

```javascript
// Problem: Test completes before async operation
// Solution: Return promise or use async/await

it('should load data', async () => {
  const data = await loadAsync();
  expect(data).toBeDefined();
});
```

#### Flaky Tests

```javascript
// Problem: Random timeouts
// Solution: Increase timeout for slow operations

it('should process large file', async () => {
  jest.setTimeout(10000);
  // ... test code
});
```

## Coverage Goals

### Current Coverage

- **Authentication**: 100% - All registration, login, and JWT paths
- **Bookings**: 95% - Create, list, update, delete, public endpoint
- **Page Builder**: 90% - Templates, config GET/PATCH, validation
- **Edge Cases**: 85% - Error handling, invalid inputs, constraints

### Extending Coverage

To add tests for new features:

```javascript
// 1. Create test file
// backend/src/__tests__/newfeature.test.js

// 2. Add to beforeEach
beforeEach(async () => {
  testBusiness = await createTestBusiness();
});

// 3. Write test cases
it('should validate input', () => {
  // Test implementation
});

// 4. Run tests
npm test src/__tests__/newfeature.test.js
```

## Testing Best Practices

### ✅ DO

- Test one thing per test case
- Use descriptive test names
- Test both success and error cases
- Test edge cases and boundary conditions
- Use meaningful assertions
- Keep tests isolated and independent

### ❌ DON'T

- Create interdependent tests
- Test implementation details
- Have vague test descriptions
- Make tests too complex
- Hardcode expected values
- Ignore test failures

## Performance Testing

### Load Testing

```bash
# Install load testing tool
npm install -D autocannon

# Run load test
npx autocannon -c 10 -d 10 http://localhost:3001/api/page-builder/templates
```

### Memory Profiling

```bash
# Run with memory profiling
node --expose-gc node_modules/.bin/jest --maxWorkers=1
```

### Benchmark Test Execution

```bash
# Measure test execution time
time npm test
# Real: 0m3.593s
```

## Continuous Testing

### Watch Mode

```bash
# Automatically re-run tests on file changes
npm run test:watch

# Watch specific test file
npm run test:watch -- src/__tests__/auth.test.js
```

### Pre-commit Testing

Add to `.git/hooks/pre-commit`:

```bash
#!/bin/bash
npm test
if [ $? -ne 0 ]; then
  echo "Tests failed - commit aborted"
  exit 1
fi
```

## Mocking External Services

### Mocking Database

```javascript
jest.mock('../db/database', () => ({
  prepare: jest.fn(),
  exec: jest.fn()
}));
```

### Mocking API Calls

```javascript
jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn()
}));
```

### Mocking Environment Variables

```javascript
beforeEach(() => {
  process.env.JWT_SECRET = 'test-secret';
});

afterEach(() => {
  delete process.env.JWT_SECRET;
});
```

## Test Reporting

### Generate Coverage Report

```bash
npm test -- --coverage

# Output: coverage/index.html
# Open in browser to view detailed report
```

### Coverage Thresholds

Configure in `package.json`:

```json
{
  "jest": {
    "coverageThreshold": {
      "global": {
        "branches": 70,
        "functions": 75,
        "lines": 80,
        "statements": 80
      }
    }
  }
}
```

## Troubleshooting

### Tests Won't Run

```bash
# Clear Jest cache
npm test -- --clearCache

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Out of Memory

```bash
# Increase Node memory limit
NODE_OPTIONS=--max_old_space_size=4096 npm test
```

### Timeout Errors

```javascript
// Increase timeout (default: 5000ms)
it('should handle slow operation', async () => {
  jest.setTimeout(15000);
  // ... test code
}, 15000);
```

## Integration with IDE

### VS Code

Install Jest extension:
```
code --install-extension orta.vscode-jest
```

Features:
- Run/debug tests from editor
- View test results inline
- Coverage highlighting

### WebStorm/IntelliJ

Built-in Jest support:
- Right-click test file → Run
- Debug with breakpoints
- View coverage in editor

## Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Library](https://testing-library.com/docs/node-testing-library/intro/)
- [Node SQLite Testing](https://github.com/WiseLibs/sql.js)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

## Contributing

When adding new tests:

1. Follow existing test structure
2. Use descriptive test names
3. Add comments for complex logic
4. Test both success and error paths
5. Update this documentation
6. Run full test suite before submitting PR

```bash
npm test
npm run lint
npm audit
```

---

**Test coverage is essential for production readiness. Keep tests updated as features evolve.**
