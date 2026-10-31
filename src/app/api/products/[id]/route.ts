import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";

const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.string().optional(),
  salesPrice: z.number().nonnegative().optional(),
  costPrice: z.number().nonnegative().optional(),
  notes: z.string().optional().nullable(),
  active: z.boolean().optional(),
  taxId: z.string().optional().nullable(),
});

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params;
    const product = await db.product.findUnique({
      where: { id },
      include: {
        variants: true,
        tax: true,
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json({ product });
  } catch (error) {
    console.error("GET /api/products/[id] error:", error);
    return NextResponse.json({ error: "Failed to fetch product" }, { status: 500 });
  }
}

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    try {
      await requireRole("ADMIN", "STAFF");
    } catch (authErr) {
      if (authErr instanceof Response) return authErr;
    }

    const { id } = await props.params;
    const body = await req.json();
    const parsed = updateProductSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid data", details: parsed.error.format() }, { status: 400 });
    }

    const updated = await db.product.update({
      where: { id },
      data: parsed.data,
      include: {
        variants: true,
        tax: true,
      },
    });

    return NextResponse.json({ product: updated });
  } catch (error) {
    console.error("PATCH /api/products/[id] error:", error);
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
}
