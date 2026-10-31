import { NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { runBilling } from "@/lib/billing/billing-engine";

export async function POST(req: Request) {
  try {
    await requireRole("ADMIN", "STAFF");

    let asOfDate = new Date();
    try {
      const body = await req.json().catch(() => null);
      if (body?.asOfDate) {
        const parsed = new Date(body.asOfDate);
        if (!isNaN(parsed.getTime())) {
          asOfDate = parsed;
        }
      }
    } catch {
      // Body is optional
    }

    const result = await runBilling(asOfDate);
    return NextResponse.json(result);
  } catch (err: unknown) {
    if (err instanceof Response) return err;
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
