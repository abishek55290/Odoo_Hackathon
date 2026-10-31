import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { BillingPeriod } from "@prisma/client";

const updatePlanSchema = z.object({
  name: z.string().min(1).optional(),
  price: z.number().nonnegative().optional(),
  period: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]).optional(),
  minQuantity: z.number().int().min(1).optional(),
  autoClose: z.boolean().optional(),
  closable: z.boolean().optional(),
  pausable: z.boolean().optional(),
  renewable: z.boolean().optional(),
});

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params;
    const plan = await db.plan.findUnique({
      where: { id },
      include: {
        _count: {
          select: { subscriptions: true },
        },
      },
    });

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    return NextResponse.json({ plan });
  } catch (error) {
    console.error("GET /api/plans/[id] error:", error);
    return NextResponse.json({ error: "Failed to fetch plan" }, { status: 500 });
  }
}

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    try {
      await requireRole("ADMIN", "STAFF");
    } catch (authErr) {
      if (authErr instanceof Response) return authErr;
    }

    const { id } = await props.params;
    const body = await req.json();
    const parsed = updatePlanSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid data", details: parsed.error.format() }, { status: 400 });
    }

    const updated = await db.plan.update({
      where: { id },
      data: {
        ...parsed.data,
        period: parsed.data.period as BillingPeriod | undefined,
      },
    });

    return NextResponse.json({ plan: updated });
  } catch (error) {
    console.error("PATCH /api/plans/[id] error:", error);
    return NextResponse.json({ error: "Failed to update plan" }, { status: 500 });
  }
}
