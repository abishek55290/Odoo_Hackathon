/**
 * Subscriptions module — MEMBER 2 placeholder
 * Replace this file with full implementation.
 * Import auth helpers:
 *   import { requireAuth, requireRole, requireOwnerOrRole } from '@/middleware/auth';
 */
import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
  res.json({ success: true, data: { message: 'Subscriptions module — coming soon (Member 2)' } });
});

export default router;
