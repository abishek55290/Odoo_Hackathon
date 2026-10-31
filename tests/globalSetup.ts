/**
 * globalSetup — runs once before all test suites.
 * Creates an isolated test DB connection and runs migrations.
 */
export default async function globalSetup() {
  (process.env as any).NODE_ENV = 'test';
  // Session secret must be >= 32 chars for validation
  process.env.SESSION_SECRET = 'test-secret-key-at-least-32-characters-long!!';
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ||
    process.env.DATABASE_URL ||
    'postgresql://brightloop:brightloop@localhost:5433/brightloop?schema=public';
}
