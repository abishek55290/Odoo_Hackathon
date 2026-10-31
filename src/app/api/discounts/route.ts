import { NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { db } from "@/lib/db";
import { DiscountScope, DiscountType } from "@prisma/client";

export async function GET() {
  try {
    await requireRole("ADMIN", "STAFF");
    const discounts = await db.discount.findMany({
      include: {
        product: { select: { id: true, name: true } },
        subscription: { select: { id: true, number: true } },
      },
      orderBy: { startDate: "desc" },
    });

    const formatted = discounts.map((d: any) => ({
      ...d,
      value: Number(d.value),
      minPurchase: d.minPurchase !== null ? Number(d.minPurchase) : null,
      isExpired: d.endDate ? new Date(d.endDate) < new Date() : false,
      isExhausted: d.usageLimit !== null ? d.timesUsed >= d.usageLimit : false,
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
    // Only ADMIN can create discount rules
    await requireRole("ADMIN");

    const body = await req.json();
    const {
      name,
      type,
      value,
      minPurchase,
      minQuantity,
      startDate,
      endDate,
      usageLimit,
      scope,
      productId,
      subscriptionId,
    } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Discount name is required" }, { status: 400 });
    }

    if (!type || !Object.values(DiscountType).includes(type)) {
      return NextResponse.json({ error: "Invalid discount type (FIXED or PERCENTAGE)" }, { status: 400 });
    }

    const numValue = Number(value);
    if (isNaN(numValue) || numValue <= 0) {
      return NextResponse.json({ error: "Discount value must be greater than zero" }, { status: 400 });
    }

    if (type === "PERCENTAGE" && numValue > 100) {
      return NextResponse.json({ error: "Percentage discount cannot exceed 100%" }, { status: 400 });
    }

    if (!scope || !Object.values(DiscountScope).includes(scope)) {
      return NextResponse.json({ error: "Invalid discount scope (PRODUCT or SUBSCRIPTION)" }, { status: 400 });
    }

    if (scope === "PRODUCT" && !productId) {
      return NextResponse.json({ error: "productId is required for PRODUCT scoped discount" }, { status: 400 });
    }

    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : null;

    if (end && end < start) {
      return NextResponse.json({ error: "End date cannot be earlier than start date" }, { status: 400 });
    }

    const created = await db.discount.create({
      data: {
        name: name.trim(),
        type,
        value: numValue,
        minPurchase: minPurchase !== undefined && minPurchase !== null ? Number(minPurchase) : null,
        minQuantity: minQuantity !== undefined && minQuantity !== null ? parseInt(String(minQuantity), 10) : null,
        startDate: start,
        endDate: end,
        usageLimit: usageLimit !== undefined && usageLimit !== null ? parseInt(String(usageLimit), 10) : null,
        scope,
        productId: scope === "PRODUCT" ? productId : null,
        subscriptionId: scope === "SUBSCRIPTION" && subscriptionId ? subscriptionId : null,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof Response) return err;
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
