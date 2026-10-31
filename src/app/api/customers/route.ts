import { NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  try {
    // Only ADMIN or STAFF can list customers for subscription creation
    await requireRole("ADMIN", "STAFF");

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";

    const where: any = {
      role: "CUSTOMER",
      isActive: true,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const customers = await db.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
      },
      orderBy: { name: "asc" },
      take: 50,
    });

    return NextResponse.json({ customers });
  } catch (err: unknown) {
    if (err instanceof Response) return err;
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
