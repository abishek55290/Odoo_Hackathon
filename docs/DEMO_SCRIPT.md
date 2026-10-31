# Brightloop Subscription Management System
## 3-Minute Live Hackathon Demo Script

**Event:** Odoo Make-A-Ton Hackathon  
**Role:** Member 4 — Dashboard, Customer Portal & UI/QA  
**Total Duration:** 3 minutes (180 seconds)  

---

### [0:00 - 0:30] Introduction & Enterprise Dashboard Overview
> *"Hello judges! Welcome to **Brightloop**, an enterprise subscription management platform built for modern SaaS businesses with Odoo ERP compatibility.*
> 
> *I am Member 4, responsible for the user experience, executive reporting dashboard, and customer self-service portal.*
> 
> *(Navigate to `/dashboard` as Admin: `admin@brightloop.test`)*
> 
> *Notice our executive dashboard. Every metric displayed here is calculated directly from real database records via Prisma. We have 3 active subscriptions, generating **$8,700 in Monthly Recurring Revenue** and **$104,400 in ARR**. You can see collected revenue, outstanding receivables, and overdue invoices with immediate visual indicators.*
> 
> *Let's check the MRR calculation: Brightloop automatically normalizes daily, weekly, monthly, and yearly subscription frequencies using standard 365/12 and 52/12 amortization so executives always see accurate recurring run-rates."*

---

### [0:30 - 1:15] Reusable Components & Interactive Filtering
> *(Click period filter: "Last 30 Days" -> Click "Refresh Data")*
> 
> *"Notice the instant API-based data refresh without full-page reloads. We designed a production-grade UI kit built on Tailwind and accessible primitives, exported for the entire team: `DataTable`, `StatCard`, `StatusBadge`, `Select`, `Input`, and `LoadingSkeleton`.*
> 
> *(Scroll down to Recent Invoices table)*
> 
> *Our invoices table supports client and server pagination, live status badges (Paid, Partial, Overdue, Confirmed), and search filtering. Let's filter by 'Overdue' invoices—notice invoice `INV-2026-003` is highlighted with its exact due date."*

---

### [1:15 - 2:05] Customer Self-Service Portal & Multi-Tenancy Security
> *(Sign out -> Login as `customer@brightloop.test` / `Passw0rd!`)*
> 
> *"Now let's switch personas to a real client. When a customer logs in, our route guard immediately directs them to the `/portal`.*
> 
> *Here, the customer has complete visibility into their active subscriptions, effective start and renewal dates, and next billing date.*
> 
> *(Click on 'My Invoices & Statements' tab)*
> 
> *In the Invoices tab, customers can view their payment statuses. Let's click 'View Details' on invoice `INV-2026-002`: the modal renders the exact line items, GST tax breakdown, and payment history.*
> 
> ***Critical Security Feature:*** *Customer isolation is strictly enforced at the database query layer using the authenticated session's user ID. Even if a malicious user tries to request another tenant's ID via direct API calls, our endpoint rejects it. Customer 1 cannot see a single record from Customer 2."*

---

### [2:05 - 2:40] End-to-End Billing Lifecycle & Duplicate Protection
> *(Show terminal / QA test report)*
> 
> *"To ensure billing integrity, we ran comprehensive QA test suites across the entire lifecycle:*
> 1. *Creating products with Odoo variants.*
> 2. *Quotation generation and subscription activation.*
> 3. *Automated billing runs with strict database-level duplicate protection: our schema enforces `@@unique([subscriptionId, periodStart])`, preventing double-billing errors.*
> 4. *Recording partial and full payments with live balance updates.*
> 5. *Full responsive testing on mobile and tablet viewport widths."*

---

### [2:40 - 3:00] Performance & Conclusion
> *"In automated benchmark tests, our end-to-end data pipeline executed in just **140 milliseconds**, well below the 2-second hackathon SLA requirement.*
> 
> *All components are tested, the production build compiles with zero errors, and the branch `feature/dashboard-portal` is clean and ready for immediate deployment.*
> 
> *Thank you, and we'd love to take your questions!"*
