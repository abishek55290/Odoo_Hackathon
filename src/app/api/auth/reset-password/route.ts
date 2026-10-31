import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { passwordSchema } from "@/lib/validation";

const bodySchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: passwordSchema,
});

export async function POST(req: Request) {
  try {
    const raw = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { token, password } = parsed.data;
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // Lookup user with valid non-expired reset token
    const user = await db.user.findFirst({
      where: {
        resetToken: hashedToken,
        resetExpires: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid or expired password reset token. Please request a new one." },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Atomically update password and invalidate single-use token
    await db.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetExpires: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Password has been successfully reset. You may now log in.",
    });
  } catch (err: any) {
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
