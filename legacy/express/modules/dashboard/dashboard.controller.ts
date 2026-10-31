import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '@/lib/response';
import { getCurrentUser } from '@/middleware/auth';
import * as DashboardService from './dashboard.service';

/**
 * GET /api/dashboard/stats & GET /api/dashboard/summary
 * Executive finance and recurring subscription metrics.
 * Restricted to ADMIN and STAFF.
 */
export async function getStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const stats = await DashboardService.getAdminDashboardStats();
    sendSuccess(res, stats);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/dashboard/my-stats
 * Self-service portal metrics for the logged-in customer.
 * Ownership strictly enforced via session user id.
 */
export async function getMyStats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendError(res, 'Authentication required.', 401, 'UNAUTHORIZED');
      return;
    }

    const stats = await DashboardService.getCustomerDashboardStats(user.id);
    sendSuccess(res, stats);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/portal/subscriptions
 */
export async function getCustomerSubscriptions(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendError(res, 'Authentication required.', 401, 'UNAUTHORIZED');
      return;
    }

    const stats = await DashboardService.getCustomerDashboardStats(user.id);
    sendSuccess(res, { subscriptions: stats.subscriptions, count: stats.subscriptions.length });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/portal/invoices
 */
export async function getCustomerInvoices(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendError(res, 'Authentication required.', 401, 'UNAUTHORIZED');
      return;
    }

    const stats = await DashboardService.getCustomerDashboardStats(user.id);
    sendSuccess(res, { invoices: stats.invoices, count: stats.invoices.length });
  } catch (err) {
    next(err);
  }
}
