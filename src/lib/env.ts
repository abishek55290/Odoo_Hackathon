export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
  DATABASE_URL: process.env.DATABASE_URL || '',
  SESSION_SECRET: process.env.SESSION_SECRET || 'brightloop-default-secret-min-32-chars-long!',
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || process.env.SESSION_SECRET || 'brightloop-default-secret-min-32-chars-long!',
  NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'http://localhost:3000',
  APP_BASE_URL: process.env.APP_BASE_URL || 'http://localhost:3000',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  SMTP_FROM: process.env.SMTP_FROM || process.env.MAIL_FROM || 'Brightloop <noreply@brightloop.test>',
  RESET_TOKEN_EXPIRY_MINUTES: process.env.RESET_TOKEN_EXPIRY_MINUTES ? parseInt(process.env.RESET_TOKEN_EXPIRY_MINUTES, 10) : 30,
  LOGIN_RATE_LIMIT_MAX: process.env.LOGIN_RATE_LIMIT_MAX ? parseInt(process.env.LOGIN_RATE_LIMIT_MAX, 10) : 10,
  LOGIN_RATE_LIMIT_DURATION_SECONDS: process.env.LOGIN_RATE_LIMIT_DURATION_SECONDS ? parseInt(process.env.LOGIN_RATE_LIMIT_DURATION_SECONDS, 10) : 900,
};

export type Env = typeof env;
