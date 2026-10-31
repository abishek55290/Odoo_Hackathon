/**
 * Auth Service — pure business logic, no Express types here.
 * All DB access goes through Prisma. All passwords hashed with bcryptjs.
 */

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '@/config/database';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';
import { sendMail, passwordResetTemplate } from '@/lib/mailer';
import {
  ConflictError,
  UnauthorizedError,
  NotFoundError,
  AppError,
} from '@/lib/errors';
import type { SessionUser } from '@/types/session';
import type {
  RegisterInput,
  LoginInput,
  ForgotPasswordInput,
  ResetPasswordInput,
} from './auth.validators';

const SALT_ROUNDS = 12;

// ─────────────────────────────────────────────────────────────────────────────
// Register
// ─────────────────────────────────────────────────────────────────────────────

export async function registerUser(input: RegisterInput): Promise<SessionUser> {
  const email = input.email.trim().toLowerCase();

  // Uniqueness check
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ConflictError(
      'An account with this email address already exists.',
    );
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      // role defaults to CUSTOMER per schema
    },
  });

  logger.info('User registered', { userId: user.id, email: user.email });

  return toSessionUser(user);
}

// ─────────────────────────────────────────────────────────────────────────────
// Login
// ─────────────────────────────────────────────────────────────────────────────

export async function loginUser(input: LoginInput): Promise<SessionUser> {
  const email = input.email.trim().toLowerCase();

  // Use a generic error message to prevent user enumeration
  const INVALID_MSG = 'Invalid email or password.';

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    // Perform a dummy hash compare to maintain consistent response time
    await bcrypt.compare(input.password, '$2a$12$dummyhashfortimingnormalisationXXXXXXXXXXXX');
    throw new UnauthorizedError(INVALID_MSG);
  }

  if (!user.isActive) {
    throw new UnauthorizedError('This account has been deactivated. Contact support.');
  }

  const passwordValid = await bcrypt.compare(input.password, user.passwordHash);
  if (!passwordValid) {
    throw new UnauthorizedError(INVALID_MSG);
  }

  logger.info('User logged in', { userId: user.id });
  return toSessionUser(user);
}

// ─────────────────────────────────────────────────────────────────────────────
// Get Current User (from DB — fresher than session snapshot)
// ─────────────────────────────────────────────────────────────────────────────

export async function getUserById(id: string): Promise<SessionUser> {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || !user.isActive) {
    throw new NotFoundError('User');
  }
  return toSessionUser(user);
}

// ─────────────────────────────────────────────────────────────────────────────
// Forgot Password
// ─────────────────────────────────────────────────────────────────────────────

export async function forgotPassword(input: ForgotPasswordInput): Promise<{
  emailSent: boolean;
  /** ONLY populated when SMTP is off — for dev convenience / testing */
  devResetUrl?: string;
}> {
  const email = input.email.trim().toLowerCase();

  const user = await prisma.user.findUnique({ where: { email } });

  // Always respond 200 — never reveal whether an email exists
  if (!user || !user.isActive) {
    logger.info('Forgot-password requested for unknown/inactive email', { email });
    return { emailSent: false };
  }

  // Expire any existing unused tokens for this user
  await prisma.passwordResetToken.updateMany({
    where: {
      userId: user.id,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { expiresAt: new Date() }, // expire immediately
  });

  // Generate cryptographically random token
  const rawToken = crypto.randomBytes(32).toString('hex');
  // Store SHA-256 hash — raw token only travels in the email link
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const expiresAt = new Date(
    Date.now() + env.RESET_TOKEN_EXPIRY_MINUTES * 60_000,
  );

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      token: tokenHash,
      expiresAt,
    },
  });

  const resetUrl = `${env.APP_BASE_URL}/reset-password?token=${rawToken}`;
  const html = passwordResetTemplate(user.firstName, resetUrl);

  const emailSent = await sendMail({
    to: user.email,
    subject: 'Reset Your Password',
    html,
    text: `Reset your password: ${resetUrl}\n\nThis link expires in ${env.RESET_TOKEN_EXPIRY_MINUTES} minutes.`,
  });

  // Dev convenience: surface the URL in the response when SMTP is off
  const result: { emailSent: boolean; devResetUrl?: string } = { emailSent };
  if (!emailSent && env.NODE_ENV !== 'production') {
    result.devResetUrl = resetUrl;
    logger.warn('SMTP off — reset URL returned in API response (dev only)', {
      resetUrl,
    });
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Reset Password
// ─────────────────────────────────────────────────────────────────────────────

export async function resetPassword(input: ResetPasswordInput): Promise<void> {
  const tokenHash = crypto
    .createHash('sha256')
    .update(input.token)
    .digest('hex');

  const resetRecord = await prisma.passwordResetToken.findUnique({
    where: { token: tokenHash },
    include: { user: true },
  });

  const INVALID_MSG = 'This password reset link is invalid or has expired.';

  if (!resetRecord) throw new AppError(INVALID_MSG, 400, 'INVALID_RESET_TOKEN');
  if (resetRecord.usedAt) throw new AppError(INVALID_MSG, 400, 'TOKEN_ALREADY_USED');
  if (resetRecord.expiresAt < new Date()) throw new AppError(INVALID_MSG, 400, 'TOKEN_EXPIRED');
  if (!resetRecord.user.isActive) throw new AppError(INVALID_MSG, 400, 'USER_INACTIVE');

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  // Atomic: mark token used + update password in a transaction
  await prisma.$transaction([
    prisma.passwordResetToken.update({
      where: { id: resetRecord.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: resetRecord.userId },
      data: { passwordHash },
    }),
  ]);

  logger.info('Password reset completed', { userId: resetRecord.userId });
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function toSessionUser(user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: import('@prisma/client').Role;
}): SessionUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
  };
}
