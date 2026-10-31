import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env from repo root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  SESSION_SECRET: z
    .string()
    .min(32, 'SESSION_SECRET must be at least 32 characters'),
  SESSION_MAX_AGE_MS: z.coerce.number().default(86_400_000), // 24 hours

  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  // SMTP — all optional; absence disables email
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('noreply@odoo-hackathon.dev'),

  RESET_TOKEN_EXPIRY_MINUTES: z.coerce.number().default(30),
  APP_BASE_URL: z.string().default('http://localhost:3000'),

  LOGIN_RATE_LIMIT_MAX: z.coerce.number().default(10),
  LOGIN_RATE_LIMIT_DURATION_SECONDS: z.coerce.number().default(900),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment configuration:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
