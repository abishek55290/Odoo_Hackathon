import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params;
    const template = await db.quotationTemplate.findUnique({
      where: { id },
      include: {
        plan: true,
        lines: {
          include: {
            product: true,
            variant: true,
          },
        },
      },
    });

    if (!template) {
      return NextResponse.json({ error: "Quotation template not found" }, { status: 404 });
    }

    return NextResponse.json({ template });
  } catch (error) {
    console.error("GET /api/quotes/[id] error:", error);
    return NextResponse.json({ error: "Failed to fetch template" }, { status: 500 });
  }
}
