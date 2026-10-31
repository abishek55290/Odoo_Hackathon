/**
 * Auth Middleware Unit Tests
 * ===========================
 * Tests requireAuth, requireRole, requireOwnerOrRole
 * with mocked Request/Response objects — no DB needed.
 */

import { Request, Response, NextFunction } from 'express';
import {
  requireAuth,
  requireRole,
  requireOwnerOrRole,
  getCurrentUser,
} from '@/middleware/auth';
import { UnauthorizedError, ForbiddenError } from '@/lib/errors';
import { Role } from '@prisma/client';
import type { SessionUser } from '@/types/session';

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

function mockRequest(user?: SessionUser, params?: Record<string, string>): Request {
  return {
    session: { user } as Request['session'],
    params: params ?? {},
    body: {},
  } as unknown as Request;
}

const mockResponse = {} as Response;

function mockNext(): NextFunction & { mock: jest.Mock } {
  const fn = jest.fn() as jest.Mock;
  return fn as unknown as NextFunction & { mock: jest.Mock };
}

const ADMIN_USER: SessionUser = {
  id: 'admin-id',
  email: 'admin@test.com',
  firstName: 'Admin',
  lastName: 'User',
  role: Role.ADMIN,
};

const STAFF_USER: SessionUser = {
  id: 'staff-id',
  email: 'staff@test.com',
  firstName: 'Staff',
  lastName: 'User',
  role: Role.STAFF,
};

const CUSTOMER_USER: SessionUser = {
  id: 'customer-id',
  email: 'cust@test.com',
  firstName: 'Customer',
  lastName: 'User',
  role: Role.CUSTOMER,
};

// ─────────────────────────────────────────────────────────────────────────────
// getCurrentUser
// ─────────────────────────────────────────────────────────────────────────────

describe('getCurrentUser()', () => {
  it('returns session user when logged in', () => {
    expect(getCurrentUser(mockRequest(ADMIN_USER))).toEqual(ADMIN_USER);
  });

  it('returns null when not logged in', () => {
    expect(getCurrentUser(mockRequest())).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// requireAuth
// ─────────────────────────────────────────────────────────────────────────────

describe('requireAuth middleware', () => {
  it('calls next() when user is authenticated', () => {
    const req = mockRequest(ADMIN_USER);
    const next = mockNext();
    requireAuth(req, mockResponse, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(); // no error arg
  });

  it('throws UnauthorizedError when no session', () => {
    const req = mockRequest();
    const next = mockNext();
    expect(() => requireAuth(req, mockResponse, next)).toThrow(UnauthorizedError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// requireRole
// ─────────────────────────────────────────────────────────────────────────────

describe('requireRole middleware', () => {
  it('allows ADMIN when role is ADMIN', () => {
    const req = mockRequest(ADMIN_USER);
    const next = mockNext();
    requireRole([Role.ADMIN])(req, mockResponse, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('allows ADMIN when roles include ADMIN and STAFF', () => {
    const req = mockRequest(ADMIN_USER);
    const next = mockNext();
    requireRole([Role.ADMIN, Role.STAFF])(req, mockResponse, next);
    expect(next).toHaveBeenCalled();
  });

  it('throws ForbiddenError when CUSTOMER tries ADMIN-only route', () => {
    const req = mockRequest(CUSTOMER_USER);
    const next = mockNext();
    expect(() => requireRole([Role.ADMIN])(req, mockResponse, next)).toThrow(ForbiddenError);
  });

  it('throws ForbiddenError when STAFF tries ADMIN-only route', () => {
    const req = mockRequest(STAFF_USER);
    const next = mockNext();
    expect(() => requireRole([Role.ADMIN])(req, mockResponse, next)).toThrow(ForbiddenError);
  });

  it('throws UnauthorizedError when unauthenticated', () => {
    const req = mockRequest();
    const next = mockNext();
    expect(() => requireRole([Role.ADMIN])(req, mockResponse, next)).toThrow(UnauthorizedError);
  });

  it('allows STAFF when ADMIN and STAFF are both allowed', () => {
    const req = mockRequest(STAFF_USER);
    const next = mockNext();
    requireRole([Role.ADMIN, Role.STAFF])(req, mockResponse, next);
    expect(next).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// requireOwnerOrRole
// ─────────────────────────────────────────────────────────────────────────────

describe('requireOwnerOrRole middleware', () => {
  it('allows CUSTOMER to access their own resource (matching userId param)', () => {
    const req = mockRequest(CUSTOMER_USER, { userId: CUSTOMER_USER.id });
    const next = mockNext();
    requireOwnerOrRole('params', 'userId', [Role.ADMIN, Role.STAFF])(req, mockResponse, next);
    expect(next).toHaveBeenCalled();
  });

  it("throws ForbiddenError when CUSTOMER tries to access another user's resource", () => {
    const req = mockRequest(CUSTOMER_USER, { userId: 'other-user-id' });
    const next = mockNext();
    expect(() =>
      requireOwnerOrRole('params', 'userId', [Role.ADMIN, Role.STAFF])(req, mockResponse, next),
    ).toThrow(ForbiddenError);
  });

  it('allows ADMIN to access any resource (bypass)', () => {
    const req = mockRequest(ADMIN_USER, { userId: 'any-user-id' });
    const next = mockNext();
    requireOwnerOrRole('params', 'userId', [Role.ADMIN, Role.STAFF])(req, mockResponse, next);
    expect(next).toHaveBeenCalled();
  });

  it('allows STAFF to access any resource (bypass)', () => {
    const req = mockRequest(STAFF_USER, { userId: 'any-user-id' });
    const next = mockNext();
    requireOwnerOrRole('params', 'userId', [Role.ADMIN, Role.STAFF])(req, mockResponse, next);
    expect(next).toHaveBeenCalled();
  });

  it('throws UnauthorizedError when unauthenticated', () => {
    const req = mockRequest(undefined, { userId: 'any-id' });
    const next = mockNext();
    expect(() =>
      requireOwnerOrRole('params', 'userId', [Role.ADMIN])(req, mockResponse, next),
    ).toThrow(UnauthorizedError);
  });
});
