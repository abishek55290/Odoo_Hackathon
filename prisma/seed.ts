import { PrismaClient, Role, BillingPeriod, SubscriptionStatus, InvoiceStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function hash(pw: string) {
  return bcrypt.hash(pw, 10);
}

async function upsertUser(email: string, name: string, role: Role, firstName?: string, lastName?: string, customPw?: string) {
  const password = customPw || "Admin123!";
  const passwordHash = await hash(password);
  return db.user.upsert({
    where: { email },
    update: { name, role, firstName, lastName, passwordHash, isActive: true },
    create: { email, name, role, firstName, lastName, passwordHash, isActive: true },
  });
}

async function main() {
  console.log("🌱  Seeding Brightloop database...");

  // Primary team demo users matching README.md exactly
  const admin = await upsertUser("admin@brightloop.test", "Admin User", Role.ADMIN, "Alice", "Admin", "Admin123!");
  const staff = await upsertUser("staff@brightloop.test", "Staff User", Role.STAFF, "Sam", "Staff", "Staff123!");
  const customer = await upsertUser("customer@brightloop.test", "Demo Customer", Role.CUSTOMER, "Charlie", "Customer", "Customer123!");

  // Additional demo users
  await upsertUser("admin@demo.dev", "Alice Admin", Role.ADMIN, "Alice", "Admin", "Admin@12345!");
  await upsertUser("staff@demo.dev", "Sam Staff", Role.STAFF, "Sam", "Staff", "Staff@12345!");
  await upsertUser("customer1@demo.dev", "Charlie Customer", Role.CUSTOMER, "Charlie", "One", "Customer@123!");
  await upsertUser("customer2@demo.dev", "Diana Customer", Role.CUSTOMER, "Diana", "Two", "Customer@456!");

  console.log("   ✓ Users seeded with synchronized credentials");

  // Taxes
  let gst = await db.tax.findFirst({ where: { name: "GST 18%" } });
  if (!gst) {
    gst = await db.tax.create({
      data: { name: "GST 18%", ratePercent: 18, active: true },
    });
  }

  // Products & Variants
  let crm = await db.product.findFirst({ where: { name: "Brightloop CRM" } });
  if (!crm) {
    crm = await db.product.create({
      data: {
        name: "Brightloop CRM",
        type: "Software",
        salesPrice: 1000,
        costPrice: 400,
        description: "Complete subscription and customer CRM platform",
        taxId: gst.id,
      },
    });
  }

  let variant = await db.productVariant.findFirst({ where: { productId: crm.id, attribute: "Brand", value: "Odoo" } });
  if (!variant) {
    variant = await db.productVariant.create({
      data: { productId: crm.id, attribute: "Brand", value: "Odoo", extraPrice: 560 },
    });
  }

  // Plans
  let monthlyPlan = await db.plan.findFirst({ where: { name: "Monthly Standard" } });
  if (!monthlyPlan) {
    monthlyPlan = await db.plan.create({
      data: {
        name: "Monthly Standard",
        price: 1000,
        period: BillingPeriod.MONTHLY,
        startDate: new Date(),
        pausable: true,
        closable: true,
        renewable: true,
      },
    });
  }

  let yearlyPlan = await db.plan.findFirst({ where: { name: "Yearly Enterprise" } });
  if (!yearlyPlan) {
    yearlyPlan = await db.plan.create({
      data: {
        name: "Yearly Enterprise",
        price: 10000,
        period: BillingPeriod.YEARLY,
        startDate: new Date(),
        pausable: true,
        closable: true,
        renewable: true,
      },
    });
  }

  // Quotation Template
  let template = await db.quotationTemplate.findFirst({ where: { name: "Standard SaaS Template" } });
  if (!template) {
    template = await db.quotationTemplate.create({
      data: {
        name: "Standard SaaS Template",
        planId: monthlyPlan.id,
        lines: {
          create: [
            {
              productId: crm.id,
              variantId: variant.id,
              quantity: 1,
            },
          ],
        },
      },
    });
  }

  // Discounts
  const discountExists = await db.discount.findFirst({ where: { name: "10% off 10+ seats" } });
  if (!discountExists) {
    await db.discount.create({
      data: {
        name: "10% off 10+ seats",
        type: "PERCENTAGE",
        value: 10,
        minQuantity: 10,
        startDate: new Date(),
        usageLimit: 100,
        scope: "PRODUCT",
        productId: crm.id,
      },
    });
  }

  // Demo Subscriptions (Future)
  let demoSub = await db.subscription.findUnique({ where: { number: "SUB-0001" } });
  if (!demoSub) {
    demoSub = await db.subscription.create({
      data: {
        number: "SUB-0001",
        customerId: customer.id,
        planId: monthlyPlan.id,
        status: SubscriptionStatus.ACTIVE,
        startDate: new Date(),
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        paymentTerms: "Net 15",
        lines: {
          create: [
            {
              productId: crm.id,
              quantity: 5,
              unitPrice: 1000,
              amount: 5000,
              taxId: gst.id,
            },
          ],
        },
      },
    });
  }

  // Legitimate Due Subscription (for live recurring billing test without fabricating dates)
  let dueSub = await db.subscription.findUnique({ where: { number: "SUB-DUE-TODAY" } });
  if (!dueSub) {
    dueSub = await db.subscription.create({
      data: {
        number: "SUB-DUE-TODAY",
        customerId: customer.id,
        planId: monthlyPlan.id,
        status: SubscriptionStatus.ACTIVE,
        paused: false,
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        nextBillingDate: new Date(Date.now() - 60 * 1000), // Legitimate past date
        paymentTerms: "Net 15",
        lines: {
          create: [
            {
              productId: crm.id,
              variantId: variant.id,
              quantity: 1,
              unitPrice: 1560, // 1000 + 560
              amount: 1560,
              taxId: gst.id,
            },
          ],
        },
      },
    });
  }

  // Demo Invoices
  let demoInv = await db.invoice.findUnique({ where: { number: "INV-0001" } });
  if (!demoInv) {
    demoInv = await db.invoice.create({
      data: {
        number: "INV-0001",
        subscriptionId: demoSub.id,
        customerId: customer.id,
        status: InvoiceStatus.CONFIRMED,
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        subtotal: 5000,
        taxTotal: 900,
        total: 5900,
        lines: {
          create: [
            {
              description: "Brightloop CRM x 5 seats",
              quantity: 5,
              unitPrice: 1000,
              taxPercent: 18,
              amount: 5000,
            },
          ],
        },
      },
    });
  }

  console.log("✅  Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
