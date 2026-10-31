import nodemailer from 'nodemailer';
import { env } from './env';
import { logger } from '@/lib/logger';

// ─────────────────────────────────────────────────────────────────────────────
// Transporter
// ─────────────────────────────────────────────────────────────────────────────

function createTransporter() {
  const smtpConfigured =
    env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS;

  if (!smtpConfigured) {
    logger.warn(
      'SMTP not configured (SMTP_HOST / SMTP_USER / SMTP_PASS missing). ' +
      'Password reset emails will NOT be sent. ' +
      'Set these env vars to enable real email delivery.',
    );
    return null;
  }

  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });
}

const transporter = createTransporter();

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

export interface MailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send an email. Returns `false` (without throwing) if SMTP is not configured.
 * This lets the reset-password endpoint return a consistent response
 * without leaking whether email was actually delivered.
 */
export async function sendMail(options: MailOptions): Promise<boolean> {
  if (!transporter) {
    logger.warn('Email not sent — SMTP unconfigured', { to: options.to, subject: options.subject });
    return false;
  }

  try {
    const info = await transporter.sendMail({
      from: env.SMTP_FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
    logger.info('Email sent', { messageId: info.messageId, to: options.to });
    return true;
  } catch (err) {
    logger.error('Email delivery failed', { error: String(err), to: options.to });
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Email Templates
// ─────────────────────────────────────────────────────────────────────────────

export function passwordResetTemplate(firstName: string, resetUrl: string): MailOptions['html'] {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Reset Your Password</title></head>
<body style="font-family:sans-serif;max-width:600px;margin:40px auto;color:#333">
  <h2 style="color:#875A7B">Password Reset Request</h2>
  <p>Hi <strong>${firstName}</strong>,</p>
  <p>We received a request to reset the password for your account.</p>
  <p>Click the button below to set a new password. This link expires in
     <strong>${env.RESET_TOKEN_EXPIRY_MINUTES} minutes</strong> and
     can only be used once.</p>
  <p style="margin:32px 0">
    <a href="${resetUrl}"
       style="background:#875A7B;color:#fff;padding:12px 24px;
              border-radius:6px;text-decoration:none;font-weight:bold">
      Reset Password
    </a>
  </p>
  <p>If you didn't request this, you can safely ignore this email.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:32px 0">
  <p style="font-size:12px;color:#999">
    This link will expire at
    ${new Date(Date.now() + env.RESET_TOKEN_EXPIRY_MINUTES * 60_000).toUTCString()}.
  </p>
</body>
</html>`;
}
