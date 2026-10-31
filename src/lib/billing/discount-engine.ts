import { Discount, DiscountScope, DiscountType } from "@prisma/client";

export interface LineItemInput {
  productId: string;
  quantity: number;
  unitPrice: number;
  rawAmount: number; // quantity * unitPrice
}

export interface AppliedDiscount {
  discountId: string;
  discountName: string;
  scope: DiscountScope;
  type: DiscountType;
  discountAmount: number;
  lineIndex?: number;
}

export interface DiscountCalculationResult {
  lineDiscounts: number[]; // discount amount per line item
  totalDiscount: number;
  appliedDiscounts: AppliedDiscount[];
  usedDiscountIds: string[];
}

/**
 * Checks if a discount is active and within usage and validity bounds.
 */
export function isDiscountEligible(discount: Discount, now: Date = new Date()): boolean {
  if (discount.startDate > now) {
    return false;
  }
  if (discount.endDate && discount.endDate < now) {
    return false;
  }
  if (discount.usageLimit !== null && discount.usageLimit !== undefined && discount.timesUsed >= discount.usageLimit) {
    return false;
  }
  return true;
}

/**
 * Calculates discount amount for a given base amount and discount rule.
 */
export function computeDiscountValue(baseAmount: number, discount: Discount): number {
  if (baseAmount <= 0) return 0;
  let amount = 0;
  if (discount.type === "PERCENTAGE") {
    const pct = Number(discount.value);
    amount = Math.round((baseAmount * pct) / 100 * 100) / 100;
  } else if (discount.type === "FIXED") {
    amount = Number(discount.value);
  }
  return Math.min(baseAmount, Math.max(0, amount));
}

/**
 * Applies eligible product-level and subscription-level discounts deterministically:
 * 1. Product-scoped discounts are evaluated for each eligible line.
 *    If multiple product discounts apply to the same line, the one offering the highest deduction is chosen.
 * 2. Subscription-scoped discounts are evaluated on the remaining subtotal.
 *    If multiple subscription discounts apply, the highest deduction is chosen.
 * 3. Total discounts are capped so no line or subtotal drops below zero.
 */
export function evaluateDiscounts(
  lines: LineItemInput[],
  discounts: Discount[],
  subscriptionId?: string,
  now: Date = new Date()
): DiscountCalculationResult {
  const lineDiscounts = lines.map(() => 0);
  const appliedDiscounts: AppliedDiscount[] = [];
  const usedDiscountIds: Set<string> = new Set();

  const eligibleDiscounts = discounts.filter((d) => isDiscountEligible(d, now));

  // 1. Process PRODUCT scoped discounts
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const matchingProductDiscounts = eligibleDiscounts.filter((d) => {
      if (d.scope !== "PRODUCT" || d.productId !== line.productId) return false;
      if (d.minQuantity !== null && d.minQuantity !== undefined && line.quantity < d.minQuantity) return false;
      if (d.minPurchase !== null && d.minPurchase !== undefined && line.rawAmount < Number(d.minPurchase)) return false;
      return true;
    });

    if (matchingProductDiscounts.length > 0) {
      // Pick best discount for line
      let bestDiscount: Discount | null = null;
      let maxDiscountVal = 0;
      for (const d of matchingProductDiscounts) {
        const val = computeDiscountValue(line.rawAmount, d);
        if (val > maxDiscountVal) {
          maxDiscountVal = val;
          bestDiscount = d;
        }
      }

      if (bestDiscount && maxDiscountVal > 0) {
        lineDiscounts[i] = maxDiscountVal;
        appliedDiscounts.push({
          discountId: bestDiscount.id,
          discountName: bestDiscount.name,
          scope: "PRODUCT",
          type: bestDiscount.type,
          discountAmount: maxDiscountVal,
          lineIndex: i,
        });
        usedDiscountIds.add(bestDiscount.id);
      }
    }
  }

  // 2. Process SUBSCRIPTION scoped discounts
  const subtotalAfterProductDiscounts = lines.reduce(
    (sum, line, idx) => sum + (line.rawAmount - lineDiscounts[idx]),
    0
  );
  const totalQuantity = lines.reduce((sum, line) => sum + line.quantity, 0);

  const matchingSubDiscounts = eligibleDiscounts.filter((d) => {
    if (d.scope !== "SUBSCRIPTION") return false;
    if (d.subscriptionId && d.subscriptionId !== subscriptionId) return false;
    if (d.minQuantity !== null && d.minQuantity !== undefined && totalQuantity < d.minQuantity) return false;
    if (d.minPurchase !== null && d.minPurchase !== undefined && subtotalAfterProductDiscounts < Number(d.minPurchase)) return false;
    return true;
  });

  if (matchingSubDiscounts.length > 0 && subtotalAfterProductDiscounts > 0) {
    let bestSubDiscount: Discount | null = null;
    let maxSubVal = 0;
    for (const d of matchingSubDiscounts) {
      const val = computeDiscountValue(subtotalAfterProductDiscounts, d);
      if (val > maxSubVal) {
        maxSubVal = val;
        bestSubDiscount = d;
      }
    }

    if (bestSubDiscount && maxSubVal > 0) {
      appliedDiscounts.push({
        discountId: bestSubDiscount.id,
        discountName: bestSubDiscount.name,
        scope: "SUBSCRIPTION",
        type: bestSubDiscount.type,
        discountAmount: maxSubVal,
      });
      usedDiscountIds.add(bestSubDiscount.id);

      // Allocate subscription discount proportionally across remaining line amounts
      let allocated = 0;
      for (let i = 0; i < lines.length; i++) {
        const remainingLineAmount = lines[i].rawAmount - lineDiscounts[i];
        if (remainingLineAmount > 0 && subtotalAfterProductDiscounts > 0) {
          const share = i === lines.length - 1
            ? Math.round((maxSubVal - allocated) * 100) / 100
            : Math.round((maxSubVal * (remainingLineAmount / subtotalAfterProductDiscounts)) * 100) / 100;
          const cappedShare = Math.min(remainingLineAmount, Math.max(0, share));
          lineDiscounts[i] += cappedShare;
          allocated += cappedShare;
        }
      }
    }
  }

  const totalDiscount = Math.round(lineDiscounts.reduce((sum, d) => sum + d, 0) * 100) / 100;

  return {
    lineDiscounts,
    totalDiscount,
    appliedDiscounts,
    usedDiscountIds: Array.from(usedDiscountIds),
  };
}
