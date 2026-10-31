/**
 * globalSetup — runs once before all test suites.
 * Creates an isolated test DB connection and runs migrations.
 */
export default async function globalSetup() {
  // In CI, DATABASE_URL points to a test DB.
  // For local dev: set DATABASE_URL to a test database before running `npm test`.
  (process.env as any).NODE_ENV = 'test';
  // Session secret must be >= 32 chars for validation
  process.env.SESSION_SECRET = 'test-secret-key-at-least-32-characters-long!!';
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ||
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/odoo_hackathon_test?schema=public';
}
