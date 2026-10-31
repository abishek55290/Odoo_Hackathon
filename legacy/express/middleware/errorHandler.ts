import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '@/lib/errors';
import { sendError } from '@/lib/response';
import { logger } from '@/lib/logger';

/**
 * Global error handler — must be registered LAST in Express.
 * Converts AppError, ZodError, and unexpected errors into consistent
 * API responses.
 */
export function globalErrorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  // ── Zod validation errors ───────────────────────────────────────────────
  if (err instanceof ZodError) {
    const message = err.errors
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join('; ');
    sendError(res, message, 400, 'VALIDATION_ERROR');
    return;
  }

  // ── Operational (known) errors ───────────────────────────────────────────
  if (err instanceof AppError && err.isOperational) {
    sendError(res, err.message, err.statusCode, err.code);
    return;
  }

  // ── Unknown / programmer errors ─────────────────────────────────────────
  logger.error('Unhandled error', {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });

  sendError(res, 'An unexpected error occurred. Please try again later.', 500, 'INTERNAL_ERROR');
}

/**
 * 404 handler — catches any unmatched routes.
 */
export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, `Route ${req.method} ${req.path} not found`, 404, 'NOT_FOUND');
}
