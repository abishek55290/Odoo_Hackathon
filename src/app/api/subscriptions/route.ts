import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Prisma } from "@prisma/client";

const lineSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional().nullable(),
  quantity: z.number().int().min(1),
  taxId: z.string().optional().nullable(),
});

const createSubscriptionSchema = z.object({
  customerId: z.string().min(1),
  planId: z.string().min(1),
  templateId: z.string().optional().nullable(),
  startDate: z.string().datetime().optional().default(() => new Date().toISOString()),
  expiryDate: z.string().datetime().optional().nullable(),
  paymentTerms: z.string().optional().default("Net 15"),
  quoteValidUntil: z.string().datetime().optional().nullable(),
  lines: z.array(lineSchema).min(1, "At least one product line is required"),
});

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const where: any = {};
    if (session.user.role === "CUSTOMER") {
      where.customerId = session.user.id;
    } else if (searchParams.get("customerId")) {
      where.customerId = searchParams.get("customerId");
    }

    if (status) {
      where.status = status;
    }

    const subscriptions = await db.subscription.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, email: true } },
        plan: true,
        lines: {
          include: {
            product: true,
            variant: true,
            tax: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ subscriptions });
  } catch (error) {
    console.error("GET /api/subscriptions error:", error);
    return NextResponse.json({ error: "Failed to fetch subscriptions" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = createSubscriptionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid subscription data", details: parsed.error.format() }, { status: 400 });
    }

    const { customerId, planId, templateId, startDate, expiryDate, paymentTerms, quoteValidUntil, lines } = parsed.data;

    // CUSTOMER can only create for themselves
    if (session.user.role === "CUSTOMER" && customerId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden: You cannot create subscriptions for other customers" }, { status: 403 });
    }

    // 1. Fetch Plan
    const plan = await db.plan.findUnique({ where: { id: planId } });
    if (!plan) {
      return NextResponse.json({ error: "Selected plan does not exist" }, { status: 400 });
    }

    // 2. Validate Customer
    const customer = await db.user.findUnique({ where: { id: customerId } });
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 400 });
    }

    // 3. Process Lines and calculate immutable snapshot prices
    const processedLines = [];
    for (const line of lines) {
      if (line.quantity < plan.minQuantity) {
        return NextResponse.json(
          { error: `Line quantity (${line.quantity}) is less than plan minimum required quantity (${plan.minQuantity})` },
          { status: 400 }
        );
      }

      const product = await db.product.findUnique({
        where: { id: line.productId },
        include: { variants: true },
      });

      if (!product || !product.active) {
        return NextResponse.json({ error: `Product ${line.productId} is not found or inactive` }, { status: 400 });
      }

      let extraPrice = new Prisma.Decimal(0);
      if (line.variantId) {
        const variant = product.variants.find((v: { id: string; extraPrice: any }) => v.id === line.variantId);
        if (!variant) {
          return NextResponse.json(
            { error: `Variant ${line.variantId} does not belong to product '${product.name}'` },
            { status: 400 }
          );
        }
        extraPrice = variant.extraPrice;
      }

      // Shared Pricing Contract:
      // Subscription line unit price is plan price + variant surcharge
      const unitPrice = new Prisma.Decimal(plan.price).add(extraPrice);
      const amount = unitPrice.mul(line.quantity);

      processedLines.push({
        productId: product.id,
        variantId: line.variantId || null,
        quantity: line.quantity,
        unitPrice,
        taxId: line.taxId || product.taxId || null,
        amount,
      });
    }

    // Generate unique subscription number e.g. SUB-0001
    const count = await db.subscription.count();
    const number = `SUB-${(count + 1).toString().padStart(4, "0")}`;

    const subscription = await db.subscription.create({
      data: {
        number,
        customerId,
        planId,
        templateId: templateId || null,
        startDate: new Date(startDate),
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        paymentTerms,
        quoteValidUntil: quoteValidUntil ? new Date(quoteValidUntil) : null,
        status: "DRAFT",
        lines: {
          create: processedLines,
        },
      },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        plan: true,
        lines: {
          include: {
            product: true,
            variant: true,
            tax: true,
          },
        },
      },
    });

    return NextResponse.json({ subscription }, { status: 201 });
  } catch (error) {
    console.error("POST /api/subscriptions error:", error);
    return NextResponse.json({ error: "Failed to create subscription" }, { status: 500 });
  }
}
