import { NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { confirmInvoice } from "@/lib/billing/invoice-service";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("ADMIN", "STAFF");
    const { id } = await params;
    const updated = await confirmInvoice(id);
    return NextResponse.json({ success: true, invoice: updated });
  } catch (err: unknown) {
    if (err instanceof Response) return err;
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
