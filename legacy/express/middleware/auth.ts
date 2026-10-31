/**
 * Authentication & Authorization Middleware
 * ==========================================
 * MEMBER 1 owns this file.
 *
 * Members 2, 3, 4 import from here:
 *   import { requireAuth, requireRole, requireOwnerOrRole, getCurrentUser }
 *     from '@/middleware/auth';
 */

import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { UnauthorizedError, ForbiddenError } from '@/lib/errors';
import type { SessionUser } from '@/types/session';

// ─────────────────────────────────────────────────────────────────────────────
// getCurrentUser
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the authenticated user from the session, or null if not logged in.
 * Use this inside route handlers when you need user info without enforcing auth.
 */
export function getCurrentUser(req: Request): SessionUser | null {
  return req.session?.user ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// requireAuth
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Middleware: enforces that a valid session exists.
 * Responds 401 if not authenticated.
 *
 * Usage:
 *   router.get('/profile', requireAuth, handler);
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const user = getCurrentUser(req);
  if (!user) {
    throw new UnauthorizedError('You must be logged in to access this resource.');
  }
  next();
}

// ─────────────────────────────────────────────────────────────────────────────
// requireRole
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Middleware factory: enforces that the authenticated user has one of the
 * specified roles. Always implies requireAuth (no need to stack both).
 *
 * Usage:
 *   router.post('/staff', requireRole(['ADMIN']), createStaffHandler);
 *   router.get('/ops', requireRole(['ADMIN', 'STAFF']), opsHandler);
 */
export function requireRole(allowedRoles: Role[]) {
  return function roleMiddleware(req: Request, _res: Response, next: NextFunction): void {
    const user = getCurrentUser(req);

    if (!user) {
      throw new UnauthorizedError();
    }

    if (!allowedRoles.includes(user.role)) {
      throw new ForbiddenError(
        `This action requires one of the following roles: ${allowedRoles.join(', ')}.`,
      );
    }

    next();
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// requireOwnerOrRole
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Middleware factory: allows access if the authenticated user owns the resource
 * (their session userId matches the given param or body field) OR they have one
 * of the bypass roles (e.g., ADMIN/STAFF can see all customers' data).
 *
 * @param ownerIdSource  - 'params' | 'body' — where to find the owner ID
 * @param ownerIdField   - field name inside req.params / req.body
 * @param bypassRoles    - roles that skip the ownership check
 *
 * Usage (resource userId in URL param):
 *   router.get('/:userId/invoices', requireOwnerOrRole('params', 'userId', ['ADMIN', 'STAFF']), handler);
 */
export function requireOwnerOrRole(
  ownerIdSource: 'params' | 'body',
  ownerIdField: string,
  bypassRoles: Role[],
) {
  return function ownerOrRoleMiddleware(req: Request, _res: Response, next: NextFunction): void {
    const user = getCurrentUser(req);

    if (!user) {
      throw new UnauthorizedError();
    }

    // Privileged roles bypass ownership check
    if (bypassRoles.includes(user.role)) {
      return next();
    }

    // Ownership check
    const resourceOwnerId =
      ownerIdSource === 'params'
        ? req.params[ownerIdField]
        : req.body?.[ownerIdField];

    if (!resourceOwnerId || resourceOwnerId !== user.id) {
      throw new ForbiddenError('You do not have permission to access this resource.');
    }

    next();
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// assertAdmin  (convenience shorthand)
// ─────────────────────────────────────────────────────────────────────────────

/** Shorthand for requireRole(['ADMIN']) */
export const assertAdmin = requireRole([Role.ADMIN]);

/** Shorthand for requireRole(['ADMIN', 'STAFF']) */
export const assertStaff = requireRole([Role.ADMIN, Role.STAFF]);
