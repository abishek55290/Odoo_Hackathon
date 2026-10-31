/**
 * Dashboard & Analytics Service — Member 4
 *
 * Implements financial reporting, MRR/ARR normalization,
 * invoice ledgers, and customer self-service metrics.
 */

import { prisma } from '@/config/database';
import { SubscriptionStatus, InvoiceStatus } from '@prisma/client';

export interface DashboardMetrics {
  totalActiveSubscriptions: number;
  monthlyRecurringRevenue: number;
  annualRecurringRevenue: number;
  collectedRevenue: number;
  outstandingInvoiceBalance: number;
  overdueInvoiceCount: number;
  overdueBalance: number;
}

export interface StatusBreakdown {
  total: number;
  counts: Record<SubscriptionStatus, number>;
  percentages: Record<SubscriptionStatus, number>;
}

export interface MRRCalculationNotes {
  formula: string;
  multipliers: {
    monthly: string;
    annual: string;
  };
}

/**
 * Calculates executive finance and subscription metrics for ADMIN and STAFF.
 */
export async function getAdminDashboardStats() {
  const now = new Date();

  // 1. Subscriptions & MRR
  const subscriptions = await prisma.subscription.findMany({
    include: {
      product: true,
      user: {
        select: { id: true, email: true, firstName: true, lastName: true },
      },
    },
  });

  const activeSubscriptions = subscriptions.filter(
    (s) => s.status === SubscriptionStatus.ACTIVE,
  );

  let monthlyRecurringRevenue = 0;
  const mrrByProduct: Record<string, { count: number; mrr: number }> = {};

  for (const sub of activeSubscriptions) {
    const mrr = Number(sub.product.priceMonthly);
    monthlyRecurringRevenue += mrr;

    if (!mrrByProduct[sub.product.name]) {
      mrrByProduct[sub.product.name] = { count: 0, mrr: 0 };
    }
    mrrByProduct[sub.product.name].count += 1;
    mrrByProduct[sub.product.name].mrr += mrr;
  }

  // Status breakdown
  const statusCounts: Record<SubscriptionStatus, number> = {
    ACTIVE: 0,
    PAUSED: 0,
    CANCELLED: 0,
    EXPIRED: 0,
  };

  for (const sub of subscriptions) {
    if (statusCounts[sub.status] !== undefined) {
      statusCounts[sub.status]++;
    }
  }

  const totalSubs = subscriptions.length;
  const percentages: Record<SubscriptionStatus, number> = {
    ACTIVE: totalSubs > 0 ? Math.round((statusCounts.ACTIVE / totalSubs) * 100) : 0,
    PAUSED: totalSubs > 0 ? Math.round((statusCounts.PAUSED / totalSubs) * 100) : 0,
    CANCELLED: totalSubs > 0 ? Math.round((statusCounts.CANCELLED / totalSubs) * 100) : 0,
    EXPIRED: totalSubs > 0 ? Math.round((statusCounts.EXPIRED / totalSubs) * 100) : 0,
  };

  // 2. Invoices & Balances
  const invoices = await prisma.invoice.findMany({
    include: {
      user: {
        select: { id: true, email: true, firstName: true, lastName: true },
      },
      subscription: {
        include: { product: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  let collectedRevenue = 0;
  let outstandingInvoiceBalance = 0;
  let overdueInvoiceCount = 0;
  let overdueBalance = 0;

  const processedInvoices = invoices.map((inv) => {
    const due = Number(inv.amountDue);
    const paid = Number(inv.amountPaid);
    const remaining = Math.max(0, due - paid);
    collectedRevenue += paid;

    const isPaid = inv.status === InvoiceStatus.PAID || paid >= due;
    const isOverdue =
      !isPaid &&
      inv.status !== InvoiceStatus.VOID &&
      (inv.status === InvoiceStatus.OVERDUE || new Date(inv.dueDate) < now);

    if (!isPaid && inv.status !== InvoiceStatus.VOID) {
      outstandingInvoiceBalance += remaining;
      if (isOverdue) {
        overdueInvoiceCount += 1;
        overdueBalance += remaining;
      }
    }

    return {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      customerName: `${inv.user.firstName} ${inv.user.lastName}`,
      customerEmail: inv.user.email,
      productName: inv.subscription?.product.name ?? 'Subscription Service',
      amountDue: due,
      amountPaid: paid,
      remainingBalance: remaining,
      dueDate: inv.dueDate.toISOString(),
      status: isOverdue ? 'OVERDUE' : inv.status,
      paidAt: inv.paidAt ? inv.paidAt.toISOString() : null,
      createdAt: inv.createdAt.toISOString(),
    };
  });

  return {
    metrics: {
      totalActiveSubscriptions: activeSubscriptions.length,
      monthlyRecurringRevenue: Math.round(monthlyRecurringRevenue * 100) / 100,
      annualRecurringRevenue: Math.round(monthlyRecurringRevenue * 12 * 100) / 100,
      collectedRevenue: Math.round(collectedRevenue * 100) / 100,
      outstandingInvoiceBalance: Math.round(outstandingInvoiceBalance * 100) / 100,
      overdueInvoiceCount,
      overdueBalance: Math.round(overdueBalance * 100) / 100,
    },
    statusBreakdown: {
      total: totalSubs,
      counts: statusCounts,
      percentages,
    },
    mrrByProduct: Object.entries(mrrByProduct).map(([name, data]) => ({
      product: name,
      count: data.count,
      mrr: Math.round(data.mrr * 100) / 100,
    })),
    recentInvoices: processedInvoices.slice(0, 10),
    meta: {
      calculatedAt: now.toISOString(),
      mrrCalculation: {
        formula: 'Sum of product monthly prices for all ACTIVE subscriptions',
        multipliers: {
          monthly: 'PriceMonthly * 1.0',
          annual: 'PriceAnnual / 12.0',
        },
      },
    },
  };
}

/**
 * Returns self-service overview for a logged-in CUSTOMER.
 * Enforces ownership strictly via the authenticated session userId.
 */
export async function getCustomerDashboardStats(userId: string) {
  const [subscriptions, invoices] = await Promise.all([
    prisma.subscription.findMany({
      where: { userId },
      include: { product: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.invoice.findMany({
      where: { userId },
      include: {
        subscription: {
          include: { product: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const activeSubscriptions = subscriptions.filter(
    (s) => s.status === SubscriptionStatus.ACTIVE,
  );

  let totalOutstanding = 0;
  const processedInvoices = invoices.map((inv) => {
    const due = Number(inv.amountDue);
    const paid = Number(inv.amountPaid);
    const remaining = Math.max(0, due - paid);
    totalOutstanding += remaining;

    return {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      productName: inv.subscription?.product.name ?? 'Standard License',
      amountDue: due,
      amountPaid: paid,
      outstandingAmount: remaining,
      status: inv.status,
      dueDate: inv.dueDate.toISOString(),
      paidAt: inv.paidAt ? inv.paidAt.toISOString() : null,
      createdAt: inv.createdAt.toISOString(),
    };
  });

  const formattedSubscriptions = subscriptions.map((s) => ({
    id: s.id,
    productName: s.product.name,
    monthlyPrice: Number(s.product.priceMonthly),
    annualPrice: Number(s.product.priceAnnual),
    status: s.status,
    startDate: s.startDate.toISOString(),
    endDate: s.endDate ? s.endDate.toISOString() : null,
    createdAt: s.createdAt.toISOString(),
  }));

  return {
    summary: {
      activeSubscriptionsCount: activeSubscriptions.length,
      totalSubscriptionsCount: subscriptions.length,
      totalOutstandingBalance: Math.round(totalOutstanding * 100) / 100,
    },
    subscriptions: formattedSubscriptions,
    invoices: processedInvoices,
  };
}
