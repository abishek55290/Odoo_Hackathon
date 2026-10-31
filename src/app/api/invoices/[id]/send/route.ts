import { NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { sendInvoiceEmail } from "@/lib/billing/invoice-service";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("ADMIN", "STAFF");
    const { id } = await params;
    const result = await sendInvoiceEmail(id);
    return NextResponse.json(result);
  } catch (err: unknown) {
    if (err instanceof Response) return err;
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    const status = msg.includes("SMTP is not configured") ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
