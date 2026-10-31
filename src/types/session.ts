// ─────────────────────────────────────────────────────────────────────────────
// Global Type Declarations
// ─────────────────────────────────────────────────────────────────────────────

import { Role } from '@prisma/client';
import 'express-session';

/**
 * The user object stored in every authenticated session.
 * Exported so Members 2, 3, 4 can import it:
 *   import type { SessionUser } from '@/types/session';
 */
export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
}

// Augment express-session to include our user
declare module 'express-session' {
  interface SessionData {
    user: SessionUser;
  }
}
