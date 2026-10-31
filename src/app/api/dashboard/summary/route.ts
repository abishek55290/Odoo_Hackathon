import { NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { db } from "@/lib/db";
import { BillingPeriod } from "@prisma/client";

function normalizeToMonthly(amount: number, period: BillingPeriod): number {
  switch (period) {
    case BillingPeriod.DAILY:
      return amount * (365 / 12);
    case BillingPeriod.WEEKLY:
      return amount * (52 / 12);
    case BillingPeriod.MONTHLY:
      return amount;
    case BillingPeriod.YEARLY:
      return amount / 12;
    default:
      return amount;
  }
}

export async function GET() {
  try {
    await requireRole("ADMIN", "STAFF");

    const now = new Date();

    // 1. Fetch active subscriptions for MRR calculation
    const activeSubs = await db.subscription.findMany({
      where: {
        status: "ACTIVE",
        paused: false,
      },
      include: {
        plan: true,
        lines: true,
      },
    });

    let mrr = 0;
    for (const sub of activeSubs) {
      const lineTotal = sub.lines.reduce((s: number, l: any) => s + Number(l.amount), 0);
      const amount = lineTotal > 0 ? lineTotal : Number(sub.plan.price);
      mrr += normalizeToMonthly(amount, sub.plan.period);
    }

    const arr = mrr * 12;

    // 2. Subscriptions status breakdown
    const allSubs = await db.subscription.findMany({
      select: { status: true, paused: true },
    });

    const statusBreakdown = {
      DRAFT: 0,
      QUOTATION: 0,
      CONFIRMED: 0,
      ACTIVE: 0,
      PAUSED: 0,
      CLOSED: 0,
    };

    for (const s of allSubs) {
      if (s.status === "ACTIVE" && s.paused) {
        statusBreakdown.PAUSED++;
      } else if (statusBreakdown[s.status as keyof typeof statusBreakdown] !== undefined) {
        statusBreakdown[s.status as keyof typeof statusBreakdown]++;
      }
    }

    // 3. Invoices and payments metrics
    const invoices = await db.invoice.findMany({
      include: {
        payments: true,
        customer: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    let totalBilled = 0;
    let totalOutstanding = 0;
    let overdueCount = 0;
    let overdueBalance = 0;

    for (const inv of invoices) {
      const total = Number(inv.total);
      const paid = inv.payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
      const balance = Math.max(0, Math.round((total - paid) * 100) / 100);

      if (inv.status !== "CANCELLED") {
        totalBilled += total;
        totalOutstanding += balance;

        const isOverdue = inv.status !== "PAID" && new Date(inv.dueDate) < now;
        if (isOverdue) {
          overdueCount++;
          overdueBalance += balance;
        }
      }
    }

    // 4. Total collected payments
    const payments = await db.payment.findMany({
      select: { amount: true },
    });
    const collectedRevenue = payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);

    // 5. Recent 6 Invoices
    const recentInvoices = invoices.slice(0, 6).map((inv: any) => {
      const total = Number(inv.total);
      const paid = inv.payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
      return {
        id: inv.id,
        number: inv.number,
        customerName: inv.customer?.name || "Customer",
        status: inv.status,
        total,
        balance: Math.max(0, Math.round((total - paid) * 100) / 100),
        dueDate: inv.dueDate,
        createdAt: inv.createdAt,
      };
    });

    return NextResponse.json({
      metrics: {
        activeSubscriptionsCount: activeSubs.length,
        totalSubscriptionsCount: allSubs.length,
        mrr: Math.round(mrr * 100) / 100,
        arr: Math.round(arr * 100) / 100,
        totalBilled: Math.round(totalBilled * 100) / 100,
        collectedRevenue: Math.round(collectedRevenue * 100) / 100,
        outstandingBalance: Math.round(totalOutstanding * 100) / 100,
        overdueCount,
        overdueBalance: Math.round(overdueBalance * 100) / 100,
      },
      statusBreakdown,
      recentInvoices,
    });
  } catch (err: unknown) {
    if (err instanceof Response) return err;
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
