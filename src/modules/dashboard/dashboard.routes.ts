import { Router } from 'express';
import { requireAuth, requireRole } from '@/middleware/auth';
import * as DashboardController from './dashboard.controller';

const router = Router();

/**
 * Dashboard & Customer Portal Routes — Member 4
 *
 * Executive Dashboard (ADMIN, STAFF):
 *   GET /api/dashboard/stats
 *   GET /api/dashboard/summary
 *
 * Customer Self-Service Portal (Any logged-in user / CUSTOMER):
 *   GET /api/dashboard/my-stats
 *   GET /api/dashboard/my-subscriptions
 *   GET /api/dashboard/my-invoices
 *   GET /api/portal/subscriptions
 *   GET /api/portal/invoices
 */

// Executive endpoints — restricted to ADMIN and STAFF
router.get('/stats', requireRole(['ADMIN', 'STAFF']), DashboardController.getStats);
router.get('/summary', requireRole(['ADMIN', 'STAFF']), DashboardController.getStats);

// Customer self-service endpoints — restricted to authenticated users, filtered by session ID
router.get('/my-stats', requireAuth, DashboardController.getMyStats);
router.get('/my-subscriptions', requireAuth, DashboardController.getCustomerSubscriptions);
router.get('/my-invoices', requireAuth, DashboardController.getCustomerInvoices);
router.get('/subscriptions', requireAuth, DashboardController.getCustomerSubscriptions);
router.get('/invoices', requireAuth, DashboardController.getCustomerInvoices);

export default router;
