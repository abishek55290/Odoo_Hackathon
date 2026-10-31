# Brightloop — Subscription Management System

![Next.js](https://img.shields.io/badge/Next.js-16.4-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue?logo=typescript)
![Prisma](https://img.shields.io/badge/Prisma-6.19-2D3748?logo=prisma)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791?logo=postgresql)
![Tailwind](https://img.shields.io/badge/Tailwind-CSS-38B2AC?logo=tailwind-css)

A complete, production-grade **Subscription Management System** built for **Odoo Make-A-Ton 9.0**.

Brightloop delivers end-to-end recurring billing, multi-attribute catalog management, quotation templates, automated invoices, payment collection, real-time MRR/ARR analytics, and a self-service customer portal.

---

## 🏗️ Architecture & Modules

The application is built on a unified Next.js App Router architecture with PostgreSQL and Prisma ORM:

```
.
├── prisma/
│   ├── schema.prisma                  # Complete PostgreSQL schema (Users, Products, Plans, Subscriptions, Invoices, Payments, Taxes, Discounts)
│   └── seed.ts                        # Multi-role database seeder (Admin, Staff, Customer, Products, Plans)
├── src/
│   ├── app/                           # Next.js App Router (UI Pages & REST API routes)
│   │   ├── (auth)/                    # Authentication flows (Login, Register, Forgot Password, Reset Password)
│   │   ├── (app)/                     # Authenticated workspace
│   │   │   ├── products/              # Product catalog & variant management
│   │   │   ├── plans/                 # Subscription plans (Daily, Weekly, Monthly, Yearly)
│   │   │   ├── quotes/                # Quotation templates & pre-bundled line items
│   │   │   ├── subscriptions/         # Subscription lifecycle management (new, edit, transition)
│   │   │   ├── invoices/              # Invoice confirmation, cancellation, and PDF print preview
│   │   │   ├── payments/              # Payment recording & ledger
│   │   │   ├── reports/               # Executive dashboard (MRR, ARR, Cashflow, Overdue KPIs)
│   │   │   └── portal/                # Customer self-service portal (own subscriptions & invoices)
│   │   └── api/                       # Enterprise JSON REST APIs
│   ├── components/                    # Reusable Tailwind UI components (cards, tables, badges, dialogs)
│   ├── lib/                           # Core business logic engines
│   │   ├── billing/                   # Recurring billing engine, date math, tax & discount engines
│   │   ├── auth.ts                    # NextAuth credentials provider with bcrypt & active status check
│   │   ├── db.ts                      # Prisma client singleton
│   │   ├── env.ts                     # Runtime environment variable validation with Zod
│   │   ├── logger.ts                  # Structured production logger
│   │   └── mailer.ts                  # Secure transactional mailer
│   └── proxy.ts                       # Next.js 16 route guard & session validation
├── legacy/                            # Preserved Express backend & Odoo Python integration modules
└── tests/                             # Automated test suite (Unit & Integration)
```

---

## 👥 Four-Member Integration Matrix

| Member | Focus Area | Deliverables & Integrated Features |
|---|---|---|
| **Member 1** | Auth, Database & Security | NextAuth credentials auth, bcrypt password hashing, active account enforcement, 32-byte SHA-256 password reset tokens, admin-only staff creation (`/api/users/staff`), Prisma PostgreSQL schema. |
| **Member 2** | Catalog & Subscriptions | Product catalog with multi-attribute variants and price surcharges, subscription plans (DAILY, WEEKLY, MONTHLY, YEARLY), quotation templates (`/quotes`), subscription lifecycle machine (`DRAFT` $\rightarrow$ `QUOTATION` $\rightarrow$ `CONFIRMED` $\rightarrow$ `ACTIVE` $\rightarrow$ `PAUSED` $\rightarrow$ `CLOSED`). |
| **Member 3** | Billing & Finance | Automated recurring billing engine (`/api/billing/run`), double-count pricing fix, invoice state machine (`DRAFT` $\rightarrow$ `CONFIRMED` $\rightarrow$ `PAID`), tax engine with basis points, discount engine, payment collection ledger (`/api/payments`). |
| **Member 4** | Dashboard & Customer Portal | Executive reporting dashboard (`/reports`, `/api/dashboard/summary`) with real normalized MRR, ARR, cashflow; customer self-service portal (`/portal`) with strict tenant isolation; UI component design system. |

---

## 🔧 Critical Bug Fixes & Architectural Improvements

1. **Double-Counted Variant Surcharge Fixed**:
   - *Previous issue*: When generating an invoice from a subscription line, `billing-engine.ts` computed `line.quantity * (line.unitPrice + (line.variant ? line.variant.extraPrice : 0))`. Because `line.unitPrice` already stores the snapshot price (`plan.price + variant.extraPrice`), the variant surcharge was charged twice (e.g. ₹1000 base + ₹560 variant billed as ₹2120 instead of ₹1560).
   - *Fix*: Removed the redundant surcharge addition in `billing-engine.ts`; line calculation strictly follows `line.quantity * line.unitPrice`.
2. **Unified Next.js App Router Architecture**:
   - Isolated legacy duplicate Express server files into `legacy/express/` so they no longer cause TypeScript or build collisions with Next.js 16.
3. **Deterministic UTC Billing Period Calculation**:
   - Replaced buggy `setMonth` mutations with UTC-aware leap year math (`calculateNextBillingPeriod`). Correctly advances Jan 31 in leap years to Feb 29, Jan 31 in non-leap years to Feb 28, and handles Feb 29 to Feb 28 for yearly billing.
4. **Concurrency-Safe Subscription Numbering**:
   - `POST /api/subscriptions` features a randomized loop with collision detection to safely assign human-readable identifiers (`SUB-XXXX`).
5. **Real Password Reset Workflow**:
   - Created `POST /api/auth/forgot-password` and `POST /api/auth/reset-password` using single-use SHA-256 hashed 32-byte tokens with 30-minute expiration.
6. **Customer Portal Multi-Tenant Security**:
   - `/api/portal/subscriptions` and `/api/portal/invoices` enforce that `CUSTOMER` users can only access records matching `session.user.id`.

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js**: v18+ (tested on Node v20 / v24)
- **PostgreSQL**: Local instance or Docker container on port `5432`

### 2. Configure Environment
```bash
cp .env.example .env
```
Ensure your `.env` contains:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/brightloop?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="brightloop-super-secure-production-secret-key-32chars"
```

### 3. Install Dependencies & Generate Prisma Client
```bash
npm install
npm run db:generate
```

### 4. Setup Database & Seed Data
```bash
# Push schema migrations
npm run db:push

# Run seed script
npm run db:seed
```

### 5. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔑 Default Seeded Credentials

| Role | Email | Password | Permissions |
|---|---|---|---|
| **Admin** | `admin@brightloop.test` | `Admin123!` | Complete access: staff creation, plans, taxes, billing, reports |
| **Staff** | `staff@brightloop.test` | `Staff123!` | Daily operations: products, subscriptions, invoices, payments |
| **Customer** | `customer@brightloop.test` | `Customer123!` | Self-service portal (`/portal`), own subscriptions and invoices |

---

## 🧪 Testing & Quality Assurance

### Run Unit & Integration Tests
```bash
npm test
```
*Current test suite*: **4 test suites passed, 22 tests passed** (including core billing date math, leap year calculations, tax calculations, discount evaluation, pricing double-count regression, auth password policies, and crypto token verification).

### Run Strict TypeScript Check
```bash
npm run typecheck
```
*Result*: **0 errors**.

### Run Production Build
```bash
npm run build
```
*Result*: **All 35 static and dynamic routes compiled successfully**.

---

## 📄 License
Built for Odoo Make-A-Ton 9.0 Hackathon. All rights reserved.
