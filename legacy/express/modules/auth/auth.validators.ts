import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Shared field rules
// ─────────────────────────────────────────────────────────────────────────────

const emailField = z
  .string({ required_error: 'Email is required' })
  .trim()
  .toLowerCase()
  .email('Must be a valid email address');

const passwordField = z
  .string({ required_error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(
    /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
    'Password must contain at least one special character',
  );

// ─────────────────────────────────────────────────────────────────────────────
// Register
// ─────────────────────────────────────────────────────────────────────────────

export const registerSchema = z.object({
  email:     emailField,
  password:  passwordField,
  firstName: z.string({ required_error: 'First name is required' }).trim().min(1).max(100),
  lastName:  z.string({ required_error: 'Last name is required' }).trim().min(1).max(100),
});

export type RegisterInput = z.infer<typeof registerSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Login
// ─────────────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email:    emailField,
  password: z.string({ required_error: 'Password is required' }).min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Forgot Password
// ─────────────────────────────────────────────────────────────────────────────

export const forgotPasswordSchema = z.object({
  email: emailField,
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Reset Password
// ─────────────────────────────────────────────────────────────────────────────

export const resetPasswordSchema = z
  .object({
    token:           z.string({ required_error: 'Token is required' }).min(1),
    password:        passwordField,
    confirmPassword: z.string({ required_error: 'Password confirmation is required' }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
