import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";

const templateLineSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional().nullable(),
  quantity: z.number().int().min(1).default(1),
});

const createQuoteTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  planId: z.string().min(1, "Plan is required"),
  validityDays: z.number().int().min(1).default(30),
  lines: z.array(templateLineSchema).min(1, "At least one product line is required"),
});

export async function GET() {
  try {
    const templates = await db.quotationTemplate.findMany({
      include: {
        plan: true,
        lines: {
          include: {
            product: true,
            variant: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ templates });
  } catch (error) {
    console.error("GET /api/quotes error:", error);
    return NextResponse.json({ error: "Failed to fetch quotation templates" }, { status: 500 });
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
    const parsed = createQuoteTemplateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid quotation template data", details: parsed.error.format() }, { status: 400 });
    }

    const { name, planId, validityDays, lines } = parsed.data;

    const plan = await db.plan.findUnique({ where: { id: planId } });
    if (!plan) {
      return NextResponse.json({ error: "Selected plan does not exist" }, { status: 400 });
    }

    const template = await db.quotationTemplate.create({
      data: {
        name,
        planId,
        validityDays,
        lines: {
          create: lines.map((l) => ({
            productId: l.productId,
            variantId: l.variantId || null,
            quantity: l.quantity,
          })),
        },
      },
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

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error("POST /api/quotes error:", error);
    return NextResponse.json({ error: "Failed to create template" }, { status: 500 });
  }
}
