import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import session from 'express-session';
import cookieParser from 'cookie-parser';

import { env } from '@/config/env';
import { globalErrorHandler, notFoundHandler } from '@/middleware/errorHandler';

// Route modules
import authRouter from '@/modules/auth/auth.routes';
// Members 2/3/4 will add their routers here:
// import subscriptionsRouter from '@/modules/subscriptions/subscriptions.routes';
// import invoicesRouter from '@/modules/invoices/invoices.routes';
import dashboardRouter from '@/modules/dashboard/dashboard.routes';

// ─────────────────────────────────────────────────────────────────────────────
// Session store
// ─────────────────────────────────────────────────────────────────────────────

/**
 * In production use connect-pg-simple for durable sessions.
 * In test/development fall back to the default in-memory store
 * (avoids needing a running Postgres for unit tests).
 */
function buildSessionStore() {
  if (env.NODE_ENV === 'production') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const PgSession = require('connect-pg-simple')(session);
    return new PgSession({
      conString: env.DATABASE_URL,
      tableName: 'user_sessions',
      createTableIfMissing: true,
    });
  }
  return undefined; // express-session default MemoryStore
}

// ─────────────────────────────────────────────────────────────────────────────
// App factory
// ─────────────────────────────────────────────────────────────────────────────

export function createApp() {
  const app = express();

  // ── Security headers ────────────────────────────────────────────────────
  app.use(helmet());

  // ── CORS ────────────────────────────────────────────────────────────────
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true, // required for cookies cross-origin
    }),
  );

  // ── Body parsing ─────────────────────────────────────────────────────────
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser(env.SESSION_SECRET));

  // ── HTTP logging (skip in test) ──────────────────────────────────────────
  if (env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  // ── Session ──────────────────────────────────────────────────────────────
  app.use(
    session({
      name: 'connect.sid',
      secret: env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      rolling: true, // reset expiry on every request
      store: buildSessionStore(),
      cookie: {
        httpOnly: true,                                // not accessible via JS
        secure: env.NODE_ENV === 'production',        // HTTPS only in prod
        sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: env.SESSION_MAX_AGE_MS,
        signed: true,
      },
    }),
  );

  // ── Health check ─────────────────────────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', env: env.NODE_ENV, timestamp: new Date().toISOString() });
  });

  // ── API Routes ───────────────────────────────────────────────────────────
  app.use('/api/auth', authRouter);
  // app.use('/api/subscriptions', subscriptionsRouter);  // Member 2
  // app.use('/api/invoices', invoicesRouter);            // Member 3
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/portal', dashboardRouter); // Member 4

  // ── 404 & Error handlers ─────────────────────────────────────────────────
  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  return app;
}


