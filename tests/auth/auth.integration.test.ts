/**
 * Auth Integration Tests
 * ======================
 * Tests all 6 auth endpoints end-to-end via supertest.
 * Each describe block cleans up its own test users.
 *
 * Run:  npm test
 *
 * Requires a running Postgres with DATABASE_URL set.
 * For unit/mock-only testing without a DB, see auth.service.unit.test.ts
 */

import request from 'supertest';
import { createApp } from '@/app';
import { prisma } from '@/config/database';

const app = createApp();

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const TEST_EMAIL = `test-auth-${Date.now()}@example.com`;
const VALID_PASSWORD = 'TestPass@123!';
const WEAK_PASSWORD = 'password';

async function cleanupUser(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  afterAll(() => cleanupUser(TEST_EMAIL));

  it('registers a new user and returns session', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: TEST_EMAIL,
        password: VALID_PASSWORD,
        firstName: 'Test',
        lastName: 'User',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toMatchObject({
      email: TEST_EMAIL,
      firstName: 'Test',
      lastName: 'User',
      role: 'CUSTOMER',
    });
    expect(res.body.data.user).not.toHaveProperty('passwordHash');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('rejects duplicate email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: TEST_EMAIL,
        password: VALID_PASSWORD,
        firstName: 'Dupe',
        lastName: 'User',
      });
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('CONFLICT');
  });

  it('rejects weak password (no uppercase)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'weak@example.com', password: 'nouppercase1!', firstName: 'A', lastName: 'B' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('rejects password without special character', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'nospec@example.com', password: 'NoSpecChar123', firstName: 'A', lastName: 'B' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('rejects short password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'short@example.com', password: 'Sh!1', firstName: 'A', lastName: 'B' });
    expect(res.status).toBe(400);
  });

  it('rejects invalid email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: VALID_PASSWORD, firstName: 'A', lastName: 'B' });
    expect(res.status).toBe(400);
  });

  it('normalises email to lowercase', async () => {
    const upper = `UPPER-${Date.now()}@Example.COM`;
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: upper, password: VALID_PASSWORD, firstName: 'A', lastName: 'B' });
    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe(upper.toLowerCase());
    // Cleanup
    await cleanupUser(upper.toLowerCase());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  const LOGIN_EMAIL = `login-test-${Date.now()}@example.com`;

  beforeAll(async () => {
    await request(app).post('/api/auth/register').send({
      email: LOGIN_EMAIL,
      password: VALID_PASSWORD,
      firstName: 'Login',
      lastName: 'Tester',
    });
  });

  afterAll(() => cleanupUser(LOGIN_EMAIL));

  it('logs in with correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: LOGIN_EMAIL, password: VALID_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(LOGIN_EMAIL);
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('rejects wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: LOGIN_EMAIL, password: 'WrongPass@999!' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('rejects unknown email without revealing existence', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@nowhere.com', password: VALID_PASSWORD });
    expect(res.status).toBe(401);
    // Message must be generic
    expect(res.body.error).toMatch(/invalid email or password/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/me  +  POST /api/auth/logout
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/auth/me and POST /api/auth/logout', () => {
  const ME_EMAIL = `me-test-${Date.now()}@example.com`;
  let cookie: string;

  beforeAll(async () => {
    await request(app).post('/api/auth/register').send({
      email: ME_EMAIL,
      password: VALID_PASSWORD,
      firstName: 'Me',
      lastName: 'Tester',
    });
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: ME_EMAIL, password: VALID_PASSWORD });
    cookie = loginRes.headers['set-cookie'][0];
  });

  afterAll(() => cleanupUser(ME_EMAIL));

  it('GET /me returns authenticated user', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(ME_EMAIL);
  });

  it('GET /me returns 401 without session', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('POST /logout clears session', async () => {
    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', cookie);
    expect(logoutRes.status).toBe(200);

    // Cookie should no longer authenticate
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookie);
    expect(meRes.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/forgot-password  +  POST /api/auth/reset-password
// ─────────────────────────────────────────────────────────────────────────────

describe('Password Reset Flow', () => {
  const RESET_EMAIL = `reset-test-${Date.now()}@example.com`;

  beforeAll(async () => {
    await request(app).post('/api/auth/register').send({
      email: RESET_EMAIL,
      password: VALID_PASSWORD,
      firstName: 'Reset',
      lastName: 'Tester',
    });
  });

  afterAll(() => cleanupUser(RESET_EMAIL));

  it('forgot-password returns 200 for existing email', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: RESET_EMAIL });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('forgot-password returns 200 for unknown email (no account leak)', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nobody-ever@nowhere.com' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('reset-password fails with invalid token', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({
        token: 'invalid-fake-token',
        password: 'NewPass@999!',
        confirmPassword: 'NewPass@999!',
      });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('full reset flow: forgot → reset → login with new password', async () => {
    // 1. Request reset (SMTP off → devResetUrl in response)
    const forgotRes = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: RESET_EMAIL });
    expect(forgotRes.status).toBe(200);

    // Extract raw token from devResetUrl (dev mode only)
    const devUrl: string | undefined = forgotRes.body.data?.devResetUrl;
    if (!devUrl) {
      console.warn('SMTP appears configured — skipping token extraction from devResetUrl');
      return;
    }

    const url = new URL(devUrl);
    const rawToken = url.searchParams.get('token') as string;
    expect(rawToken).toBeTruthy();

    const newPassword = 'NewReset@999!';

    // 2. Reset password
    const resetRes = await request(app)
      .post('/api/auth/reset-password')
      .send({
        token: rawToken,
        password: newPassword,
        confirmPassword: newPassword,
      });
    expect(resetRes.status).toBe(200);

    // 3. Login with new password
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: RESET_EMAIL, password: newPassword });
    expect(loginRes.status).toBe(200);

    // 4. Confirm token is one-time — reusing it must fail
    const reuseRes = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: rawToken, password: 'Attempt@999!', confirmPassword: 'Attempt@999!' });
    expect(reuseRes.status).toBe(400);
    expect(reuseRes.body.code).toBe('TOKEN_ALREADY_USED');
  });

  it('reset-password rejects mismatched confirmPassword', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'x', password: 'Valid@123!', confirmPassword: 'Different@123!' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/do not match/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Role-based access
// ─────────────────────────────────────────────────────────────────────────────

describe('Role enforcement', () => {
  it('CUSTOMER session user has role CUSTOMER', async () => {
    const email = `role-cust-${Date.now()}@example.com`;
    const registerRes = await request(app).post('/api/auth/register').send({
      email, password: VALID_PASSWORD, firstName: 'C', lastName: 'User',
    });
    expect(registerRes.body.data.user.role).toBe('CUSTOMER');
    await cleanupUser(email);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Health check
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns 200 ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
