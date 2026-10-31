# AGENTS.md — Shared Team Contract
# Odoo Hackathon — Multi-Member Backend

> **Read this file before writing any code.**
> Every member owns specific modules. Coordinate before touching shared files.

---

## Repository Layout

```
.
├── prisma/
│   ├── schema.prisma         ← MEMBER 1 owns — do NOT edit without coordination
│   └── seed.ts               ← MEMBER 1 owns
├── src/
│   ├── server.ts             ← shared entry point (touch only for route registration)
│   ├── app.ts                ← Express app factory
│   ├── config/               ← MEMBER 1 owns
│   ├── middleware/           ← MEMBER 1 owns (auth helpers exported for all)
│   ├── modules/
│   │   ├── auth/             ← MEMBER 1 owns
│   │   ├── subscriptions/    ← MEMBER 2 owns
│   │   ├── invoices/         ← MEMBER 3 owns
│   │   └── dashboard/        ← MEMBER 4 owns
│   ├── lib/                  ← shared utilities (coordinate before editing)
│   └── types/                ← MEMBER 1 owns global types
└── tests/
    ├── auth/                 ← MEMBER 1
    ├── subscriptions/        ← MEMBER 2
    ├── invoices/             ← MEMBER 3
    └── dashboard/            ← MEMBER 4
```

---

## Shared Auth Helpers (Member 1 Exports)

Import from `@/middleware/auth`:

```typescript
import {
  requireAuth,           // Express middleware — 401 if no valid session
  requireRole,           // requireRole(['ADMIN','STAFF']) — 403 if wrong role
  requireOwnerOrRole,    // requireOwnerOrRole('userId', ['ADMIN']) — for CUSTOMER ownership
  getCurrentUser,        // (req) => SessionUser | null
} from '@/middleware/auth';
```

### SessionUser type (from `@/types/session`)

```typescript
interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'ADMIN' | 'STAFF' | 'CUSTOMER';
}
```

---

## API Contract

### Base URL
- Development: `http://localhost:4000/api`

### Response Envelope

All responses follow this shape:

```json
// Success
{ "success": true, "data": { ... } }

// Error
{ "success": false, "error": "Human-readable message", "code": "MACHINE_CODE" }
```

### Authentication
Sessions are carried via HTTP-only signed cookies (`connect.sid`).
No tokens needed in headers for browser clients.
For API clients use `credentials: 'include'` on every fetch.

---

## Auth Endpoints (Member 1)

| Method | Path | Auth | Role |
|---|---|---|---|
| POST | /api/auth/register | No | — |
| POST | /api/auth/login | No | — |
| POST | /api/auth/logout | Yes | Any |
| GET | /api/auth/me | Yes | Any |
| POST | /api/auth/forgot-password | No | — |
| POST | /api/auth/reset-password | No | — |

## Subscription Endpoints (Member 2)

| Method | Path | Auth | Role |
|---|---|---|---|
| GET | /api/subscriptions | Yes | ADMIN/STAFF = all; CUSTOMER = own |
| GET | /api/subscriptions/:id | Yes | ADMIN/STAFF/owner |
| POST | /api/subscriptions | Yes | ADMIN/STAFF |
| PATCH | /api/subscriptions/:id | Yes | ADMIN/STAFF |
| DELETE | /api/subscriptions/:id | Yes | ADMIN |

## Invoice Endpoints (Member 3)

| Method | Path | Auth | Role |
|---|---|---|---|
| GET | /api/invoices | Yes | ADMIN/STAFF = all; CUSTOMER = own |
| GET | /api/invoices/:id | Yes | ADMIN/STAFF/owner |
| POST | /api/invoices | Yes | ADMIN/STAFF |
| PATCH | /api/invoices/:id/status | Yes | ADMIN/STAFF |

## Dashboard Endpoints (Member 4)

| Method | Path | Auth | Role |
|---|---|---|---|
| GET | /api/dashboard/stats | Yes | ADMIN/STAFF |
| GET | /api/dashboard/my-stats | Yes | CUSTOMER |

---

## Database Rules

- **MEMBER 1 owns** `prisma/schema.prisma`.
- Other members may **propose** additions via PR comments.
- Never run `prisma migrate dev --reset` in shared environments.
- Run `npm run db:generate` after any schema change.

## Coding Standards

- TypeScript strict mode — no `any` unless justified with a comment.
- Use the shared `ApiResponse` helpers from `@/lib/response`.
- All thrown errors must use `AppError` from `@/lib/errors`.
- Validate all request bodies with `zod` schemas.
- No `console.log` in production paths — use the logger from `@/lib/logger`.
