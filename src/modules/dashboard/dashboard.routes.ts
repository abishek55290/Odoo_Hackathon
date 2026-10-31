/**
 * Dashboard module — MEMBER 4 placeholder
 */
import { Router } from 'express';

const router = Router();

router.get('/stats', (_req, res) => {
  res.json({ success: true, data: { message: 'Dashboard module — coming soon (Member 4)' } });
});

export default router;
