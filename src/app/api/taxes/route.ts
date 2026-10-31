import { NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { db } from "@/lib/db";
import { percentToBps, bpsToPercent } from "@/lib/billing/tax-engine";

export async function GET() {
  try {
    await requireRole("ADMIN", "STAFF");
    const taxes = await db.tax.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { products: true, lines: true } },
      },
    });

    const formatted = taxes.map((t: any) => {
      const rate = Number(t.ratePercent);
      return {
        id: t.id,
        name: t.name,
        ratePercent: rate,
        basisPoints: percentToBps(rate),
        active: t.active,
        usageCount: t._count.products + t._count.lines,
      };
    });

    return NextResponse.json(formatted);
  } catch (err: unknown) {
    if (err instanceof Response) return err;
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    // Only ADMIN can create tax rules
    await requireRole("ADMIN");

    const body = await req.json();
    const { name, ratePercent, basisPoints, active } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Tax name is required" }, { status: 400 });
    }

    let rate: number;
    if (basisPoints !== undefined && basisPoints !== null) {
      rate = bpsToPercent(Number(basisPoints));
    } else if (ratePercent !== undefined && ratePercent !== null) {
      rate = Number(ratePercent);
    } else {
      return NextResponse.json({ error: "Tax rate (ratePercent or basisPoints) is required" }, { status: 400 });
    }

    if (isNaN(rate) || rate < 0 || rate > 100) {
      return NextResponse.json({ error: "Tax rate must be between 0% and 100%" }, { status: 400 });
    }

    const created = await db.tax.create({
      data: {
        name: name.trim(),
        ratePercent: rate,
        active: active !== undefined ? Boolean(active) : true,
      },
    });

    return NextResponse.json(
      {
        id: created.id,
        name: created.name,
        ratePercent: Number(created.ratePercent),
        basisPoints: percentToBps(Number(created.ratePercent)),
        active: created.active,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    if (err instanceof Response) return err;
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
