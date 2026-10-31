# Brightloop — Subscription Management System (Odoo Hackathon)

![Odoo 17](https://img.shields.io/badge/Odoo-17.0-875A7B?logo=odoo)
![Next.js](https://img.shields.io/badge/Next.js-14%2F15-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue?logo=typescript)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma)
![Tailwind](https://img.shields.io/badge/Tailwind-CSS-38B2AC?logo=tailwind-css)

A complete, production-grade **Subscription Management System** built for Odoo Make-A-Ton 9.0 by our 4-person engineering team.

---

## 🏗️ Architecture & Team Ownership

| Member | Focus Area | Key Deliverables |
|---|---|---|
| **Member 1** | Auth, Database & Security | NextAuth & Express auth foundation, Prisma schema, session security, password reset, Odoo Python addon (`auth_integration/`) |
| **Member 2** | Catalog & Subscriptions | Product catalog & variants, subscription plans, quotation templates, subscription state lifecycle machine (`src/app/api/products`, `src/app/api/plans`, `src/app/api/subscriptions`, `src/app/api/quotes`) |
| **Member 3** | Billing & Finance | Recurring billing engine, automatic invoice generation, tax & discount engines, payments processing (`src/lib/billing`, `src/app/api/invoices`, `src/app/api/payments`) |
| **Member 4** | Dashboard & Customer Portal | Executive KPIs, customer self-service portal, UI component kit, analytics & QA validation scripts (`components/ui`, `src/modules/dashboard`, `docs/`) |

---

## 🚀 Quick Start

### 1. Configure Environment
```bash
cp .env.example .env
```
Ensure `DATABASE_URL` points to your PostgreSQL database (or run `docker compose up -d`).

### 2. Install Dependencies & Prepare Database
```bash
npm install
npm run db:push
npm run db:seed
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

**Default Seeded Logins** (Password: `Passw0rd!` or `Admin@123`):
- Admin: `admin@brightloop.test`
- Staff: `staff@brightloop.test`
- Customer: `customer@brightloop.test`

---

## 📦 Key Modules

- **/products**: Product catalog, multi-attribute variants, additional pricing surcharges.
- **/plans**: Recurring subscription plans (DAILY, WEEKLY, MONTHLY, YEARLY) with auto-close, pausable, and renewal policies.
- **/subscriptions**: End-to-end lifecycle (`DRAFT` $\rightarrow$ `QUOTATION` $\rightarrow$ `CONFIRMED` $\rightarrow$ `ACTIVE` $\rightarrow$ `CLOSED`, `PAUSE`, `RESUME`, `RENEW`), with automatic `nextBillingDate` scheduling.
- **/quotes**: Quotation templates with preset plans and product line bundles.
- **/invoices & /payments**: Recurring billing execution, invoice life cycle (`DRAFT` $\rightarrow$ `CONFIRMED` $\rightarrow$ `PAID`), tax rules, and discount calculation.
- **/portal**: Customer self-service subscription & billing management.
- **auth_integration/**: Odoo 17 Python addon for OAuth2, JWT sessions, TOTP/MFA, and audit logging.

---

## 🧪 Testing & Verification
- Test all billing operations: `npx tsx tests/billing.test.ts`
- Test subscription lifecycle: `npx tsx tests/catalog-subscriptions.test.ts`
- Test dashboard endpoints: `npx tsx scripts/test-qa.ts`
