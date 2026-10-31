import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { BillingPeriod } from "@prisma/client";

const createPlanSchema = z.object({
  name: z.string().min(1, "Plan name is required"),
  price: z.number().nonnegative("Price must be positive"),
  period: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]).default("MONTHLY"),
  minQuantity: z.number().int().min(1).default(1),
  startDate: z.string().optional().default(() => new Date().toISOString()),
  endDate: z.string().optional().nullable(),
  autoClose: z.boolean().default(false),
  closable: z.boolean().default(true),
  pausable: z.boolean().default(false),
  renewable: z.boolean().default(true),
});

export async function GET() {
  try {
    const plans = await db.plan.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { subscriptions: true },
        },
      },
    });

    return NextResponse.json({ plans });
  } catch (error) {
    console.error("GET /api/plans error:", error);
    return NextResponse.json({ error: "Failed to fetch plans" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    try {
      await requireRole("ADMIN", "STAFF");
    } catch (authErr) {
      if (authErr instanceof Response) return authErr;
    }

    const body = await req.json();
    const parsed = createPlanSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid plan data", details: parsed.error.format() }, { status: 400 });
    }

    const { name, price, period, minQuantity, startDate, endDate, autoClose, closable, pausable, renewable } = parsed.data;

    // Validation: End date cannot precede start date
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : null;
    if (end && end < start) {
      return NextResponse.json({ error: "Plan end date cannot precede start date" }, { status: 400 });
    }

    const plan = await db.plan.create({
      data: {
        name,
        price,
        period: period as BillingPeriod,
        minQuantity,
        startDate: start,
        endDate: end,
        autoClose,
        closable,
        pausable,
        renewable,
      },
    });

    return NextResponse.json({ plan }, { status: 201 });
  } catch (error) {
    console.error("POST /api/plans error:", error);
    return NextResponse.json({ error: "Failed to create plan" }, { status: 500 });
  }
}
