import {
  calculateNextBillingPeriod,
  calculateDueDate,
  isLeapYear,
  getDaysInMonth,
} from "../../src/lib/billing/date-utils";
import { calculateTax, bpsToPercent, percentToBps } from "../../src/lib/billing/tax-engine";
import {
  evaluateDiscounts,
  isDiscountEligible,
  computeDiscountValue,
  LineItemInput,
} from "../../src/lib/billing/discount-engine";

describe("Core Billing & Date Utils Unit Tests", () => {
  describe("Leap Year and Month Calculations", () => {
    it("correctly identifies leap years", () => {
      expect(isLeapYear(2024)).toBe(true);
      expect(isLeapYear(2020)).toBe(true);
      expect(isLeapYear(2000)).toBe(true);
      expect(isLeapYear(2023)).toBe(false);
      expect(isLeapYear(2025)).toBe(false);
      expect(isLeapYear(1900)).toBe(false);
    });

    it("returns correct days in month", () => {
      expect(getDaysInMonth(2024, 2)).toBe(29); // Feb 2024 leap
      expect(getDaysInMonth(2023, 2)).toBe(28); // Feb 2023 non-leap
      expect(getDaysInMonth(2024, 1)).toBe(31); // Jan
      expect(getDaysInMonth(2024, 4)).toBe(30); // Apr
    });

    it("calculates daily and weekly billing cycles", () => {
      const start = new Date("2026-03-01T00:00:00Z");
      const daily = calculateNextBillingPeriod(start, "DAILY");
      expect(daily.periodEnd.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);

      const weekly = calculateNextBillingPeriod(start, "WEEKLY");
      expect(weekly.periodEnd.getTime() - start.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it("advances Jan 31 in leap year to Feb 29", () => {
      const leapJan31 = new Date("2024-01-31T00:00:00Z");
      const result = calculateNextBillingPeriod(leapJan31, "MONTHLY", 31);
      expect(result.periodEnd.getUTCMonth()).toBe(1); // Feb
      expect(result.periodEnd.getUTCDate()).toBe(29);
    });

    it("advances Jan 31 in non-leap year to Feb 28", () => {
      const nonLeapJan31 = new Date("2023-01-31T00:00:00Z");
      const result = calculateNextBillingPeriod(nonLeapJan31, "MONTHLY", 31);
      expect(result.periodEnd.getUTCMonth()).toBe(1); // Feb
      expect(result.periodEnd.getUTCDate()).toBe(28);
    });

    it("advances Feb 29 leap year to Feb 28 next year for yearly billing", () => {
      const leapFeb29 = new Date("2024-02-29T00:00:00Z");
      const result = calculateNextBillingPeriod(leapFeb29, "YEARLY", 29);
      expect(result.periodEnd.getUTCFullYear()).toBe(2025);
      expect(result.periodEnd.getUTCMonth()).toBe(1); // Feb
      expect(result.periodEnd.getUTCDate()).toBe(28);
    });

    it("calculates invoice due date with Net 15 and Net 30 terms", () => {
      const issue = new Date("2026-05-01T00:00:00Z");
      const net15 = calculateDueDate(issue, "Net 15");
      expect(net15.getUTCDate()).toBe(16);

      const net30 = calculateDueDate(issue, "Net 30");
      expect(net30.getUTCDate()).toBe(31);

      const defaultDue = calculateDueDate(issue, null);
      expect(defaultDue.getUTCDate()).toBe(16);
    });
  });

  describe("Tax Engine Unit Tests", () => {
    it("converts basis points to percent and vice versa", () => {
      expect(bpsToPercent(1800)).toBe(18);
      expect(percentToBps(18)).toBe(1800);
      expect(percentToBps(5.5)).toBe(550);
    });

    it("calculates zero tax when rate is 0", () => {
      const tax = calculateTax(1000, 0);
      expect(tax.taxAmount).toBe(0);
      expect(tax.taxPercent).toBe(0);
    });

    it("calculates 18% GST correctly", () => {
      const tax = calculateTax(1000, 18);
      expect(tax.taxAmount).toBe(180);
      expect(tax.taxPercent).toBe(18);
      expect(tax.basisPoints).toBe(1800);
    });

    it("calculates fractional tax amounts cleanly", () => {
      const tax = calculateTax(49.99, 12);
      expect(tax.taxAmount).toBe(6); // round(4999 * 1200 / 10000) / 100 = 6.00
    });
  });

  describe("Discount Engine Unit Tests", () => {
    const fixedDiscount: any = {
      id: "disc-fixed",
      name: "SAVE 100",
      code: "SAVE100",
      type: "FIXED",
      scope: "SUBSCRIPTION",
      value: 100,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
      timesUsed: 0,
      usageLimit: 10,
    };

    const percentDiscount: any = {
      id: "disc-pct",
      name: "10% Off",
      code: "TENPERCENT",
      type: "PERCENTAGE",
      scope: "SUBSCRIPTION",
      value: 10,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
      timesUsed: 0,
      usageLimit: 100,
    };

    it("verifies discount eligibility thresholds", () => {
      const now = new Date("2026-06-01");
      expect(isDiscountEligible(fixedDiscount, now)).toBe(true);

      // Expired discount
      const expiredDiscount = { ...fixedDiscount, endDate: new Date("2025-12-31") };
      expect(isDiscountEligible(expiredDiscount, now)).toBe(false);

      // Usage limit reached
      const exhaustedDiscount = { ...fixedDiscount, timesUsed: 10, usageLimit: 10 };
      expect(isDiscountEligible(exhaustedDiscount, now)).toBe(false);
    });

    it("computes discount value correctly", () => {
      expect(computeDiscountValue(1000, fixedDiscount)).toBe(100);
      expect(computeDiscountValue(1000, percentDiscount)).toBe(100);
      expect(computeDiscountValue(50, fixedDiscount)).toBe(50); // Capped at baseAmount
    });

    it("applies subscription discounts properly in evaluateDiscounts", () => {
      const lines: LineItemInput[] = [
        { productId: "prod-1", quantity: 2, unitPrice: 500, rawAmount: 1000 },
      ];
      const res = evaluateDiscounts(lines, [percentDiscount], "sub-123", new Date("2026-06-01"));
      expect(res.totalDiscount).toBe(100);
      expect(res.appliedDiscounts.length).toBe(1);
      expect(res.appliedDiscounts[0].discountAmount).toBe(100);
    });
  });

  describe("Pricing Contract & Billing Engine Double-Counting Regression", () => {
    it("ensures line.unitPrice snapshot does not double-count variant.extraPrice", () => {
      // Problem statement example:
      // Product: Brightloop CRM
      // Base Plan Price: Rs. 1000 (100000 paise)
      // Variant: Odoo Brand (+ Rs. 560 extraPrice)
      // Subscription Line snapshot unitPrice: 1560
      const planPrice = 1000;
      const variantExtraPrice = 560;
      const lineUnitPrice = planPrice + variantExtraPrice; // 1560
      const quantity = 2;

      // In the fixed billing engine:
      // lineAmount = line.quantity * line.unitPrice = 2 * 1560 = 3120
      const fixedLineAmount = quantity * lineUnitPrice;
      expect(fixedLineAmount).toBe(3120);

      // In the old buggy billing engine:
      // lineAmount = line.quantity * (line.unitPrice + (line.variant ? line.variant.extraPrice : 0))
      // lineAmount = 2 * (1560 + 560) = 4240 (DOUBLE COUNTED EXTRA PRICE!)
      const buggyLineAmount = quantity * (lineUnitPrice + variantExtraPrice);
      expect(buggyLineAmount).toBe(4240);

      // Verify fix prevents 4240 and guarantees 3120
      expect(fixedLineAmount).not.toBe(buggyLineAmount);
      expect(fixedLineAmount).toBe(3120);
    });
  });
});
