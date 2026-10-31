import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SubscriptionStatus } from "@prisma/client";
import { calculateNextBillingPeriod } from "@/lib/billing/date-utils";

const transitionSchema = z.object({
  action: z.enum(["TO_QUOTATION", "CONFIRM", "ACTIVATE", "PAUSE", "RESUME", "CLOSE", "RENEW"]),
});

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await props.params;
    const body = await req.json();
    const parsed = transitionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid transition action", details: parsed.error.format() }, { status: 400 });
    }

    const { action } = parsed.data;

    const subscription = await db.subscription.findUnique({
      where: { id },
      include: { plan: true },
    });

    if (!subscription) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }

    // Role verification
    if (session.user.role === "CUSTOMER") {
      if (subscription.customerId !== session.user.id) {
        return NextResponse.json({ error: "Forbidden: Access denied" }, { status: 403 });
      }
      if (action !== "CONFIRM") {
        return NextResponse.json({ error: "Customers can only confirm quotations" }, { status: 403 });
      }
    }

    let nextStatus: SubscriptionStatus = subscription.status;
    let nextBillingDate = subscription.nextBillingDate;
    let isPaused = subscription.paused;

    const calculateNextBilling = (base: Date, period: any) => {
      return calculateNextBillingPeriod(base, period).periodEnd;
    };

    switch (action) {
      case "TO_QUOTATION": {
        if (subscription.status !== "DRAFT") {
          return NextResponse.json({ error: `Cannot transition to QUOTATION from ${subscription.status}` }, { status: 400 });
        }
        nextStatus = "QUOTATION";
        break;
      }

      case "CONFIRM": {
        if (subscription.status !== "QUOTATION" && subscription.status !== "DRAFT") {
          return NextResponse.json({ error: `Cannot confirm subscription from ${subscription.status}` }, { status: 400 });
        }
        // Reject expired quotations when confirmation is attempted
        if (subscription.quoteValidUntil && new Date() > subscription.quoteValidUntil) {
          return NextResponse.json({ error: "Quotation has expired and cannot be confirmed" }, { status: 400 });
        }
        nextStatus = "CONFIRMED";
        break;
      }

      case "ACTIVATE": {
        if (subscription.status !== "CONFIRMED") {
          return NextResponse.json({ error: `Cannot activate subscription from ${subscription.status}. Must be CONFIRMED first.` }, { status: 400 });
        }
        nextStatus = "ACTIVE";
        isPaused = false;
        nextBillingDate = calculateNextBilling(new Date(), subscription.plan.period);
        break;
      }

      case "PAUSE": {
        if (subscription.status !== "ACTIVE" || subscription.paused) {
          return NextResponse.json({ error: `Cannot pause subscription from status ${subscription.status}` }, { status: 400 });
        }
        if (!subscription.plan.pausable) {
          return NextResponse.json({ error: "This subscription plan does not allow pausing" }, { status: 400 });
        }
        isPaused = true;
        break;
      }

      case "RESUME": {
        if (subscription.status !== "ACTIVE" || !subscription.paused) {
          return NextResponse.json({ error: "Cannot resume a subscription that is not paused" }, { status: 400 });
        }
        isPaused = false;
        break;
      }

      case "CLOSE": {
        if (subscription.status !== "ACTIVE" && subscription.status !== "CONFIRMED") {
          return NextResponse.json({ error: `Cannot close subscription from ${subscription.status}` }, { status: 400 });
        }
        if (subscription.status === "ACTIVE" && !subscription.plan.closable) {
          return NextResponse.json({ error: "This subscription plan does not permit early closure" }, { status: 400 });
        }
        nextStatus = "CLOSED";
        isPaused = false;
        break;
      }

      case "RENEW": {
        if (subscription.status !== "CLOSED") {
          return NextResponse.json({ error: `Cannot renew an unclosed subscription (${subscription.status})` }, { status: 400 });
        }
        if (!subscription.plan.renewable) {
          return NextResponse.json({ error: "This plan does not permit renewal" }, { status: 400 });
        }
        nextStatus = "ACTIVE";
        isPaused = false;
        nextBillingDate = calculateNextBilling(new Date(), subscription.plan.period);
        break;
      }
    }

    const updated = await db.subscription.update({
      where: { id },
      data: {
        status: nextStatus,
        paused: isPaused,
        nextBillingDate,
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

    return NextResponse.json({ subscription: updated });
  } catch (error) {
    console.error("POST /api/subscriptions/[id]/transition error:", error);
    return NextResponse.json({ error: "Status transition failed" }, { status: 500 });
  }
}
