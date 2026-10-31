import { Router } from 'express';
import { requireAuth } from '@/middleware/auth';
import * as AuthController from './auth.controller';

const router = Router();

/**
 * Auth routes — all under /api/auth (mounted in app.ts)
 *
 * Public:
 *   POST /api/auth/register
 *   POST /api/auth/login
 *   POST /api/auth/forgot-password
 *   POST /api/auth/reset-password
 *
 * Protected:
 *   POST /api/auth/logout    (requireAuth)
 *   GET  /api/auth/me        (requireAuth)
 */

router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.post('/logout', requireAuth, AuthController.logout);
router.get('/me', requireAuth, AuthController.me);
router.post('/forgot-password', AuthController.forgotPassword);
router.post('/reset-password', AuthController.resetPassword);

export default router;
