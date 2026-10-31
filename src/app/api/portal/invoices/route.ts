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

    const invoices = await db.invoice.findMany({
      where: {
        customerId,
      },
      include: {
        payments: true,
        subscription: {
          select: { id: true, number: true },
        },
        _count: {
          select: { lines: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const formatted = invoices.map((inv: any) => {
      const total = Number(inv.total);
      const paid = inv.payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
      const outstanding = Math.max(0, Math.round((total - paid) * 100) / 100);

      return {
        id: inv.id,
        number: inv.number,
        status: inv.status,
        subscriptionNumber: inv.subscription?.number || "—",
        periodStart: inv.periodStart,
        periodEnd: inv.periodEnd,
        dueDate: inv.dueDate,
        total,
        paid,
        outstanding,
        linesCount: inv._count.lines,
        createdAt: inv.createdAt,
      };
    });

    return NextResponse.json({ invoices: formatted });
  } catch (error) {
    console.error("GET /api/portal/invoices error:", error);
    return NextResponse.json({ error: "Failed to fetch customer invoices" }, { status: 500 });
  }
}
