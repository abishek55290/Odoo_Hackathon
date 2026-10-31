import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Strictly enforce multi-tenant isolation by authenticated session user id
    const customerId = session.user.id;

    const subscriptions = await db.subscription.findMany({
      where: {
        customerId,
      },
      include: {
        plan: true,
        lines: {
          include: {
            product: true,
            variant: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ subscriptions });
  } catch (error) {
    console.error("GET /api/portal/subscriptions error:", error);
    return NextResponse.json({ error: "Failed to fetch customer subscriptions" }, { status: 500 });
  }
}
