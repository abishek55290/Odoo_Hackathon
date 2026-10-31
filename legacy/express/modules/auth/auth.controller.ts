import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '@/lib/response';
import { getCurrentUser } from '@/middleware/auth';
import * as AuthService from './auth.service';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './auth.validators';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────────────────────────────────────────────

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = registerSchema.parse(req.body);

    // Prevent re-registration while logged in
    if (getCurrentUser(req)) {
      sendError(res, 'You are already logged in.', 400, 'ALREADY_AUTHENTICATED');
      return;
    }

    const user = await AuthService.registerUser(input);

    // Automatically log in after registration
    req.session.user = user;

    sendSuccess(res, { user }, 201);
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────────────────────────────────────

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = loginSchema.parse(req.body);

    if (getCurrentUser(req)) {
      sendError(res, 'You are already logged in.', 400, 'ALREADY_AUTHENTICATED');
      return;
    }

    const user = await AuthService.loginUser(input);

    // Rotate session ID on privilege elevation (prevents session fixation)
    await new Promise<void>((resolve, reject) => {
      req.session.regenerate((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    req.session.user = user;

    sendSuccess(res, { user });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/logout
// ─────────────────────────────────────────────────────────────────────────────

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!getCurrentUser(req)) {
      sendError(res, 'Not logged in.', 400, 'NOT_AUTHENTICATED');
      return;
    }

    await new Promise<void>((resolve, reject) => {
      req.session.destroy((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Clear the session cookie
    res.clearCookie('connect.sid', { path: '/' });

    sendSuccess(res, { message: 'Logged out successfully.' });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/me
// ─────────────────────────────────────────────────────────────────────────────

export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const sessionUser = getCurrentUser(req);
    if (!sessionUser) {
      sendError(res, 'Not authenticated.', 401, 'UNAUTHORIZED');
      return;
    }

    // Re-fetch from DB for freshest data (catches deactivation, role changes)
    const user = await AuthService.getUserById(sessionUser.id);

    // Sync session with fresh data
    req.session.user = user;

    sendSuccess(res, { user });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/forgot-password
// ─────────────────────────────────────────────────────────────────────────────

export async function forgotPassword(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = forgotPasswordSchema.parse(req.body);
    const result = await AuthService.forgotPassword(input);

    // Always return 200 — never reveal account existence
    const responseData: Record<string, unknown> = {
      message:
        'If an account with that email exists, a password reset link has been sent.',
    };

    if (result.emailSent) {
      responseData.emailSent = true;
    }

    // Surface reset URL in non-production when SMTP is off
    if (result.devResetUrl) {
      responseData.devResetUrl = result.devResetUrl;
      responseData._devNote =
        'SMTP is not configured. This URL is shown for development purposes only.';
    }

    sendSuccess(res, responseData);
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/reset-password
// ─────────────────────────────────────────────────────────────────────────────

export async function resetPassword(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = resetPasswordSchema.parse(req.body);
    await AuthService.resetPassword(input);

    sendSuccess(res, {
      message: 'Password reset successfully. You may now log in with your new password.',
    });
  } catch (err) {
    next(err);
  }
}
