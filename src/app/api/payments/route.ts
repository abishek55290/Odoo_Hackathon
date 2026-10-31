import { NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { recordPayment } from "@/lib/billing/payment-engine";
import { PaymentMethod } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const invoiceId = searchParams.get("invoiceId");

    const where: any = {};
    if (invoiceId) {
      where.invoiceId = invoiceId;
    }

    if (session.user.role === "CUSTOMER") {
      where.invoice = { customerId: session.user.id };
    }

    const payments = await db.payment.findMany({
      where,
      include: {
        invoice: {
          select: {
            id: true,
            number: true,
            total: true,
            status: true,
            customer: { select: { id: true, name: true, email: true } },
          },
        },
        recordedBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { paidAt: "desc" },
    });

    const formatted = payments.map((p: any) => ({
      ...p,
      amount: Number(p.amount),
      invoice: {
        ...p.invoice,
        total: Number(p.invoice.total),
      },
    }));

    return NextResponse.json(formatted);
  } catch (err: unknown) {
    if (err instanceof Response) return err;
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireRole("ADMIN", "STAFF");

    const body = await req.json();
    const { invoiceId, amount, method, paidAt, note } = body;

    if (!invoiceId) {
      return NextResponse.json({ error: "invoiceId is required" }, { status: 400 });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
    }

    if (!method || !Object.values(PaymentMethod).includes(method as PaymentMethod)) {
      return NextResponse.json(
        { error: `Valid payment method is required (${Object.values(PaymentMethod).join(", ")})` },
        { status: 400 }
      );
    }

    const result = await recordPayment({
      invoiceId,
      amount: numAmount,
      method: method as PaymentMethod,
      paidAt,
      note,
      recordedById: session.user.id,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof Response) return err;
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
