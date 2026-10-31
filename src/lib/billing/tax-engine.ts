/**
 * Tax Engine for Brightloop Billing System.
 * Uses integer basis points and integer-cent calculations to avoid floating-point inaccuracies.
 */

export interface TaxCalculationResult {
  taxableAmount: number;
  basisPoints: number;
  taxPercent: number;
  taxAmount: number;
}

/**
 * Converts basis points to percentage.
 * Example: 1800 bps -> 18.00%
 */
export function bpsToPercent(bps: number): number {
  return bps / 100;
}

/**
 * Converts percentage to basis points.
 * Example: 18% -> 1800 bps
 */
export function percentToBps(percent: number): number {
  return Math.round(percent * 100);
}

/**
 * Deterministically calculates tax on a discounted taxable amount using integer money math.
 * Formula: round((taxableAmountCents * basisPoints) / 10000) / 100
 */
export function calculateTax(taxableAmount: number, ratePercentOrBps: number, isBps = false): TaxCalculationResult {
  if (taxableAmount <= 0) {
    return {
      taxableAmount: 0,
      basisPoints: 0,
      taxPercent: 0,
      taxAmount: 0,
    };
  }

  const basisPoints = isBps ? Math.round(ratePercentOrBps) : percentToBps(ratePercentOrBps);
  const taxPercent = bpsToPercent(basisPoints);

  const taxableCents = Math.round(taxableAmount * 100);
  // (taxableCents * basisPoints) / 10,000 gives tax in cents
  const taxCents = Math.round((taxableCents * basisPoints) / 10000);
  const taxAmount = taxCents / 100;

  return {
    taxableAmount,
    basisPoints,
    taxPercent,
    taxAmount,
  };
}
