import { BillingPeriod } from "@prisma/client";

/**
 * Returns true if the given year is a leap year.
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Returns the maximum number of days in a given year and month (1-based, 1=Jan, 12=Dec).
 */
export function getDaysInMonth(year: number, month1Based: number): number {
  return new Date(Date.UTC(year, month1Based, 0)).getUTCDate();
}

/**
 * Calculates the period start, period end, and next billing date
 * respecting monthly/yearly leap years and month-end anchor days (e.g. Jan 31 -> Feb 28 -> Mar 31).
 */
export function calculateNextBillingPeriod(
  currentDate: Date,
  period: BillingPeriod,
  anchorDay?: number
): { periodStart: Date; periodEnd: Date; nextBillingDate: Date } {
  const periodStart = new Date(currentDate);
  const anchor = anchorDay ?? periodStart.getUTCDate();

  let periodEnd: Date;

  switch (period) {
    case "DAILY": {
      periodEnd = new Date(periodStart.getTime() + 24 * 60 * 60 * 1000);
      break;
    }
    case "WEEKLY": {
      periodEnd = new Date(periodStart.getTime() + 7 * 24 * 60 * 60 * 1000);
      break;
    }
    case "MONTHLY": {
      const year = periodStart.getUTCFullYear();
      const month = periodStart.getUTCMonth(); // 0-indexed
      let nextMonth = month + 1;
      let nextYear = year;
      if (nextMonth > 11) {
        nextMonth = 0;
        nextYear += 1;
      }
      const maxDaysInNextMonth = new Date(Date.UTC(nextYear, nextMonth + 1, 0)).getUTCDate();
      const day = Math.min(anchor, maxDaysInNextMonth);

      periodEnd = new Date(Date.UTC(
        nextYear,
        nextMonth,
        day,
        periodStart.getUTCHours(),
        periodStart.getUTCMinutes(),
        periodStart.getUTCSeconds(),
        periodStart.getUTCMilliseconds()
      ));
      break;
    }
    case "YEARLY": {
      const year = periodStart.getUTCFullYear();
      const month = periodStart.getUTCMonth();
      const nextYear = year + 1;
      const maxDaysInMonth = new Date(Date.UTC(nextYear, month + 1, 0)).getUTCDate();
      const day = Math.min(anchor, maxDaysInMonth);

      periodEnd = new Date(Date.UTC(
        nextYear,
        month,
        day,
        periodStart.getUTCHours(),
        periodStart.getUTCMinutes(),
        periodStart.getUTCSeconds(),
        periodStart.getUTCMilliseconds()
      ));
      break;
    }
    default: {
      periodEnd = new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000);
      break;
    }
  }

  return {
    periodStart,
    periodEnd,
    nextBillingDate: new Date(periodEnd),
  };
}

/**
 * Calculates invoice due date based on issue date and optional payment terms (e.g., "Net 15", "Net 30").
 */
export function calculateDueDate(issueDate: Date, paymentTerms?: string | null): Date {
  let days = 15; // default Net 15
  if (paymentTerms) {
    const match = paymentTerms.match(/\d+/);
    if (match) {
      days = parseInt(match[0], 10);
    }
  }
  return new Date(issueDate.getTime() + days * 24 * 60 * 60 * 1000);
}
