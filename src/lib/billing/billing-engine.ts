import { db } from "@/lib/db";
import { InvoiceStatus, Prisma } from "@prisma/client";
import { calculateNextBillingPeriod, calculateDueDate } from "./date-utils";
import { calculateTax } from "./tax-engine";
import { evaluateDiscounts, LineItemInput } from "./discount-engine";

export interface BillingRunResult {
  success: boolean;
  timestamp: string;
  processedCount: number;
  generatedCount: number;
  skippedCount: number;
  duplicateCount: number;
  generatedInvoices: {
    id: string;
    number: string;
    subscriptionId: string;
    periodStart: Date;
    periodEnd: Date;
    total: number;
  }[];
  errors: { subscriptionId: string; error: string }[];
}

/**
 * Generates the next sequential invoice number within a transaction.
 */
async function generateNextInvoiceNumber(tx: any): Promise<string> {
  const last = await tx.invoice.findFirst({
    orderBy: { createdAt: "desc" },
    select: { number: true },
  });

  let nextSeq = 1;
  if (last?.number && last.number.startsWith("INV-")) {
    const parsed = parseInt(last.number.replace("INV-", ""), 10);
    if (!isNaN(parsed)) {
      nextSeq = parsed + 1;
    }
  }

  // Double check that number is unique; loop if necessary
  while (true) {
    const candidate = `INV-${String(nextSeq).padStart(4, "0")}`;
    const exists = await tx.invoice.findUnique({
      where: { number: candidate },
      select: { id: true },
    });
    if (!exists) {
      return candidate;
    }
    nextSeq++;
  }
}

/**
 * Executes a full automatic recurring billing run:
 * - Scans all ACTIVE, non-paused subscriptions where nextBillingDate <= now.
 * - Computes period bounds, applies eligible discounts & taxes.
 * - Creates invoice & lines, atomically advances nextBillingDate, and increments discount usage.
 */
export async function runBilling(asOfDate: Date = new Date()): Promise<BillingRunResult> {
  const result: BillingRunResult = {
    success: true,
    timestamp: asOfDate.toISOString(),
    processedCount: 0,
    generatedCount: 0,
    skippedCount: 0,
    duplicateCount: 0,
    generatedInvoices: [],
    errors: [],
  };

  // 1. Fetch eligible active subscriptions whose billing date has arrived
  const eligibleSubs = await db.subscription.findMany({
    where: {
      status: "ACTIVE",
      paused: false,
      nextBillingDate: {
        lte: asOfDate,
      },
    },
    include: {
      customer: true,
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

  result.processedCount = eligibleSubs.length;

  // 2. Fetch active discounts
  const activeDiscounts = await db.discount.findMany({
    where: {
      startDate: { lte: asOfDate },
      OR: [{ endDate: null }, { endDate: { gte: asOfDate } }],
    },
  });

  // 3. Process each subscription
  for (const sub of eligibleSubs) {
    try {
      // Calculate period start and end based on current billing date and plan period
      const currentBillingDate = sub.nextBillingDate || sub.startDate;
      const { periodStart, periodEnd } = calculateNextBillingPeriod(
        currentBillingDate,
        sub.plan.period
      );

      // Check whether subscription has expired
      if (sub.expiryDate && periodStart >= sub.expiryDate) {
        if (sub.plan.autoClose) {
          await db.subscription.update({
            where: { id: sub.id },
            data: { status: "CLOSED" },
          });
        }
        result.skippedCount++;
        continue;
      }

      // Target next billing date for next cycle
      const advancedBillingDate = periodEnd;

      // Idempotency: "nothing billed twice". Check if invoice for this subscription & periodStart already exists
      const existing = await db.invoice.findUnique({
        where: {
          subscriptionId_periodStart: {
            subscriptionId: sub.id,
            periodStart,
          },
        },
      });

      if (existing) {
        result.duplicateCount++;
        result.skippedCount++;
        // If nextBillingDate is still in the past despite existing invoice, advance it
        if (sub.nextBillingDate && sub.nextBillingDate <= asOfDate) {
          await db.subscription.update({
            where: { id: sub.id },
            data: { nextBillingDate: advancedBillingDate },
          });
        }
        continue;
      }

      // Prepare line items: use the immutable line unitPrice snapshot (do not add extraPrice twice)
      const lineInputs: LineItemInput[] = sub.lines.map((l: any) => {
        const unitPrice = Number(l.unitPrice);
        return {
          productId: l.productId,
          quantity: l.quantity,
          unitPrice,
          rawAmount: Math.round(unitPrice * l.quantity * 100) / 100,
        };
      });

      // Apply discounts
      const discountResult = evaluateDiscounts(lineInputs, activeDiscounts, sub.id, asOfDate);

      // Calculate taxes and build line records
      let calculatedSubtotal = 0;
      let calculatedDiscountTotal = 0;
      let calculatedTaxTotal = 0;

      const invoiceLinesData = sub.lines.map((l: any, index: number) => {
        const input = lineInputs[index];
        const lineDiscount = discountResult.lineDiscounts[index];
        const taxableAmount = Math.max(0, Math.round((input.rawAmount - lineDiscount) * 100) / 100);

        const taxRate = l.tax?.ratePercent ? Number(l.tax.ratePercent) : 0;
        const taxCalc = calculateTax(taxableAmount, taxRate);

        calculatedSubtotal += input.rawAmount;
        calculatedDiscountTotal += lineDiscount;
        calculatedTaxTotal += taxCalc.taxAmount;

        const variantSuffix = l.variant ? ` (${l.variant.attribute}: ${l.variant.value})` : "";
        const description = `${l.product.name}${variantSuffix}`;

        return {
          description,
          quantity: l.quantity,
          unitPrice: input.unitPrice,
          taxPercent: taxRate,
          discountAmount: lineDiscount,
          amount: taxableAmount,
        };
      });

      const invoiceSubtotal = Math.round(calculatedSubtotal * 100) / 100;
      const invoiceDiscountTotal = Math.round(calculatedDiscountTotal * 100) / 100;
      const invoiceTaxTotal = Math.round(calculatedTaxTotal * 100) / 100;
      const invoiceTotal = Math.round((invoiceSubtotal - invoiceDiscountTotal + invoiceTaxTotal) * 100) / 100;

      const dueDate = calculateDueDate(asOfDate, sub.paymentTerms);

      // Execute in atomic transaction
      const createdInvoice = await db.$transaction(async (tx: any) => {
        const invoiceNumber = await generateNextInvoiceNumber(tx);

        const inv = await tx.invoice.create({
          data: {
            number: invoiceNumber,
            subscriptionId: sub.id,
            customerId: sub.customerId,
            status: InvoiceStatus.DRAFT,
            periodStart,
            periodEnd,
            issueDate: asOfDate,
            dueDate,
            subtotal: invoiceSubtotal,
            discountTotal: invoiceDiscountTotal,
            taxTotal: invoiceTaxTotal,
            total: invoiceTotal,
            lines: {
              create: invoiceLinesData,
            },
          },
        });

        // Atomically increment discount timesUsed
        for (const discountId of discountResult.usedDiscountIds) {
          await tx.discount.update({
            where: { id: discountId },
            data: { timesUsed: { increment: 1 } },
          });
        }

        // Check if next billing period exceeds expiry
        let nextStatus = sub.status;
        if (sub.expiryDate && advancedBillingDate >= sub.expiryDate && sub.plan.autoClose) {
          nextStatus = "CLOSED";
        }

        // Advance nextBillingDate on subscription
        await tx.subscription.update({
          where: { id: sub.id },
          data: {
            nextBillingDate: advancedBillingDate,
            status: nextStatus,
          },
        });

        return inv;
      });

      result.generatedCount++;
      result.generatedInvoices.push({
        id: createdInvoice.id,
        number: createdInvoice.number,
        subscriptionId: sub.id,
        periodStart,
        periodEnd,
        total: invoiceTotal,
      });
    } catch (err: any) {
      // Prisma duplicate key code is P2002
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        result.duplicateCount++;
        result.skippedCount++;
      } else {
        const errorMsg = err instanceof Error ? err.message : String(err);
        result.errors.push({
          subscriptionId: sub.id,
          error: errorMsg,
        });
      }
    }
  }

  return result;
}
