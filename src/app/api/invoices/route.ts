import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getInvoices } from "@/lib/billing/invoice-service";
import { InvoiceStatus } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status") as InvoiceStatus | null;
    let customerIdParam = searchParams.get("customerId") || undefined;
    const search = searchParams.get("search") || undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    // If customer, only view their own invoices
    if (session.user.role === "CUSTOMER") {
      customerIdParam = session.user.id;
    }

    const data = await getInvoices({
      status: statusParam || undefined,
      customerId: customerIdParam,
      search,
      page,
      limit,
    });

    return NextResponse.json(data);
  } catch (err: unknown) {
    if (err instanceof Response) return err;
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
