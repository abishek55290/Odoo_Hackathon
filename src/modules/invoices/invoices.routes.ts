/**
 * Invoices module — MEMBER 3 placeholder
 */
import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
  res.json({ success: true, data: { message: 'Invoices module — coming soon (Member 3)' } });
});

export default router;
