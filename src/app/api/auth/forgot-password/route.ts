import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { db } from "@/lib/db";
import { emailSchema } from "@/lib/validation";
import { sendMail } from "@/lib/mailer";

const bodySchema = z.object({
  email: emailSchema,
});

export async function POST(req: Request) {
  try {
    const raw = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Please provide a valid email address." }, { status: 400 });
    }

    const email = parsed.data.email;
    const user = await db.user.findUnique({ where: { email } });

    if (user && user.isActive) {
      // Generate cryptographically random 32-byte token
      const plainToken = crypto.randomBytes(32).toString("hex");
      const hashedToken = crypto.createHash("sha256").update(plainToken).digest("hex");
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 mins

      await db.user.update({
        where: { id: user.id },
        data: {
          resetToken: hashedToken,
          resetExpires: expiresAt,
        },
      });

      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
      const resetUrl = `${baseUrl}/reset-password?token=${plainToken}`;

      // Log development link only in development mode
      if (process.env.NODE_ENV === "development") {
        console.log(`\n🔑 [PASSWORD RESET LINK FOR DEV]: ${resetUrl}\n`);
      }

      // Attempt to send email via SMTP if configured
      try {
        await sendMail({
          to: email,
          subject: "Reset your Brightloop password",
          html: `<p>Hello,</p><p>You requested a password reset. Click the link below to set a new password:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>This link will expire in 30 minutes.</p>`,
        });
      } catch (e) {
        if (process.env.NODE_ENV === "development") {
          console.warn("SMTP send skipped/failed, link logged to console.");
        }
      }
    }

    // Always return constant message to prevent account enumeration
    return NextResponse.json({
      success: true,
      message: "If an account with that email exists, password reset instructions have been sent.",
    });
  } catch (err: any) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
