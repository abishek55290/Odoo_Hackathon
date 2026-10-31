import { NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { db } from "@/lib/db";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("ADMIN");
    const { id } = await params;
    const body = await req.json();

    const data: any = {};
    if (body.name !== undefined) data.name = body.name.trim();
    if (body.type !== undefined) data.type = body.type;
    if (body.value !== undefined) data.value = Number(body.value);
    if (body.minPurchase !== undefined) data.minPurchase = body.minPurchase !== null ? Number(body.minPurchase) : null;
    if (body.minQuantity !== undefined) data.minQuantity = body.minQuantity !== null ? parseInt(String(body.minQuantity), 10) : null;
    if (body.startDate !== undefined) data.startDate = new Date(body.startDate);
    if (body.endDate !== undefined) data.endDate = body.endDate ? new Date(body.endDate) : null;
    if (body.usageLimit !== undefined) data.usageLimit = body.usageLimit !== null ? parseInt(String(body.usageLimit), 10) : null;
    if (body.timesUsed !== undefined) data.timesUsed = parseInt(String(body.timesUsed), 10);
    if (body.scope !== undefined) data.scope = body.scope;
    if (body.productId !== undefined) data.productId = body.productId;
    if (body.subscriptionId !== undefined) data.subscriptionId = body.subscriptionId;

    const updated = await db.discount.update({
      where: { id },
      data,
    });

    return NextResponse.json(updated);
  } catch (err: unknown) {
    if (err instanceof Response) return err;
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("ADMIN");
    const { id } = await params;

    await db.discount.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    if (err instanceof Response) return err;
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
