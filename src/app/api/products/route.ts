import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";

const variantSchema = z.object({
  attribute: z.string().min(1).default("Brand"),
  value: z.string().min(1),
  extraPrice: z.number().nonnegative().default(0),
});

const createProductSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.string().default("Software"),
  salesPrice: z.number().nonnegative("Sales price must be positive"),
  costPrice: z.number().nonnegative().default(0),
  notes: z.string().optional().nullable(),
  active: z.boolean().default(true),
  taxId: z.string().optional().nullable(),
  variants: z.array(variantSchema).optional().default([]),
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { notes: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [products, total] = await Promise.all([
      db.product.findMany({
        where,
        include: {
          variants: true,
          tax: true,
        },
        orderBy: { name: "asc" },
        skip,
        take: limit,
      }),
      db.product.count({ where }),
    ]);

    return NextResponse.json({
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/products error:", error);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    try {
      await requireRole("ADMIN", "STAFF");
    } catch (authErr) {
      if (authErr instanceof Response) return authErr;
    }

    const body = await req.json();
    const parsed = createProductSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid product data", details: parsed.error.format() }, { status: 400 });
    }

    const { name, type, salesPrice, costPrice, notes, active, taxId, variants } = parsed.data;

    const product = await db.product.create({
      data: {
        name,
        type,
        salesPrice,
        costPrice,
        notes,
        active,
        taxId: taxId || null,
        variants: {
          create: variants.map((v) => ({
            attribute: v.attribute,
            value: v.value,
            extraPrice: v.extraPrice,
          })),
        },
      },
      include: {
        variants: true,
        tax: true,
      },
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    console.error("POST /api/products error:", error);
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}
