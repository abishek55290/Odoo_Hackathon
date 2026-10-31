import { NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { db } from "@/lib/db";
import { percentToBps, bpsToPercent } from "@/lib/billing/tax-engine";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("ADMIN");
    const { id } = await params;
    const body = await req.json();
    const { name, ratePercent, basisPoints, active } = body;

    const data: any = {};
    if (name !== undefined) data.name = name.trim();
    if (basisPoints !== undefined) data.ratePercent = bpsToPercent(Number(basisPoints));
    else if (ratePercent !== undefined) data.ratePercent = Number(ratePercent);
    if (active !== undefined) data.active = Boolean(active);

    const updated = await db.tax.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      ratePercent: Number(updated.ratePercent),
      basisPoints: percentToBps(Number(updated.ratePercent)),
      active: updated.active,
    });
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

    await db.tax.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    if (err instanceof Response) return err;
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
