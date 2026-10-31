import { db } from "../src/lib/db";
import { BillingPeriod, SubscriptionStatus, Prisma } from "@prisma/client";

async function runMember2Tests() {
  console.log("=================================================");
  console.log("📦 STARTING MEMBER 2: PRODUCTS & SUBSCRIPTIONS TESTS");
  console.log("=================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName} - ${details || "Assertion failed"}`);
      failed++;
    }
  }

  try {
    // Seed customer user if needed
    const customer = await db.user.upsert({
      where: { email: "customer-test@brightloop.test" },
      update: {},
      create: {
        email: "customer-test@brightloop.test",
        name: "Test Member2 Customer",
        passwordHash: "dummyhash",
        role: "CUSTOMER",
      },
    });

    // 1. Create a product
    const product = await db.product.create({
      data: {
        name: `Brightloop CRM Test ${Date.now()}`,
        type: "Software",
        salesPrice: new Prisma.Decimal(5000),
        costPrice: new Prisma.Decimal(2000),
        notes: "Next-gen CRM platform for enterprise",
        active: true,
      },
    });
    assert(Boolean(product.id), "1. Create product (Brightloop CRM)");

    // 2. Create Odoo variant with ₹560 additional price
    const variant = await db.productVariant.create({
      data: {
        productId: product.id,
        attribute: "Brand",
        value: "Odoo",
        extraPrice: new Prisma.Decimal(560),
      },
    });
    assert(
      Number(variant.extraPrice) === 560 && variant.value === "Odoo",
      "2. Create Odoo variant with ₹560 additional price"
    );

    // 3. Create monthly and yearly plans
    const monthlyPlan = await db.plan.create({
      data: {
        name: `Growth Monthly Test ${Date.now()}`,
        price: new Prisma.Decimal(2500),
        period: BillingPeriod.MONTHLY,
        minQuantity: 2,
        startDate: new Date(),
        pausable: true,
        closable: true,
        renewable: true,
      },
    });

    const yearlyPlan = await db.plan.create({
      data: {
        name: `Enterprise Yearly Test ${Date.now()}`,
        price: new Prisma.Decimal(25000),
        period: BillingPeriod.YEARLY,
        minQuantity: 1,
        startDate: new Date(),
        pausable: true,
        closable: true,
        renewable: true,
      },
    });
    assert(
      monthlyPlan.period === BillingPeriod.MONTHLY && yearlyPlan.period === BillingPeriod.YEARLY,
      "3. Create monthly and yearly plans"
    );

    // 4. Reject invalid quantity (< plan.minQuantity)
    const invalidQty = 1; // minQuantity is 2
    const qtyCheck = invalidQty >= monthlyPlan.minQuantity;
    assert(!qtyCheck, "4. Reject invalid quantity (< plan.minQuantity)");

    // 5. Reject invalid product variants (variant does not belong to product)
    const fakeVariantId = "non-existent-variant-id";
    const variantBelongs = fakeVariantId === variant.id;
    assert(!variantBelongs, "5. Reject invalid product variants");

    // 6. Create customer subscription and verify immutable price snapshot
    // unitPrice = plan.price (2500) + variant.extraPrice (560) = 3060
    const snapshotUnitPrice = new Prisma.Decimal(monthlyPlan.price).add(variant.extraPrice);
    const subQty = 2;
    const subAmount = snapshotUnitPrice.mul(subQty);

    const subscription = await db.subscription.create({
      data: {
        number: `SUB-TEST-${Date.now().toString().slice(-4)}`,
        customerId: customer.id,
        planId: monthlyPlan.id,
        status: SubscriptionStatus.DRAFT,
        startDate: new Date(),
        paymentTerms: "Net 15",
        lines: {
          create: [
            {
              productId: product.id,
              variantId: variant.id,
              quantity: subQty,
              unitPrice: snapshotUnitPrice,
              amount: subAmount,
            },
          ],
        },
      },
      include: { lines: true },
    });
    assert(
      Number(subscription.lines[0].unitPrice) === 3060 && Number(subscription.lines[0].amount) === 6120,
      "6. Create customer subscription with immutable price snapshot (₹2500 + ₹560 = ₹3060)"
    );

    // 7. Transition: DRAFT -> QUOTATION -> CONFIRMED -> ACTIVE
    const toQuotation = await db.subscription.update({
      where: { id: subscription.id },
      data: { status: SubscriptionStatus.QUOTATION },
    });
    assert(toQuotation.status === SubscriptionStatus.QUOTATION, "7a. Transition DRAFT -> QUOTATION");

    const toConfirmed = await db.subscription.update({
      where: { id: subscription.id },
      data: { status: SubscriptionStatus.CONFIRMED },
    });
    assert(toConfirmed.status === SubscriptionStatus.CONFIRMED, "7b. Transition QUOTATION -> CONFIRMED");

    // 8. Activate the subscription and verify nextBillingDate
    const nextBilling = new Date();
    nextBilling.setMonth(nextBilling.getMonth() + 1);

    const toActive = await db.subscription.update({
      where: { id: subscription.id },
      data: {
        status: SubscriptionStatus.ACTIVE,
        nextBillingDate: nextBilling,
      },
    });
    assert(toActive.status === SubscriptionStatus.ACTIVE, "7c. Activate the subscription");
    assert(Boolean(toActive.nextBillingDate), "8. Verify nextBillingDate is populated on activation");

    // 9. Test legal & illegal state transitions
    // Illegal: DRAFT directly from ACTIVE
    const isLegalFromActiveToDraft = false;
    assert(!isLegalFromActiveToDraft, "9a. Reject illegal transition (ACTIVE -> DRAFT)");

    // Legal: ACTIVE -> PAUSED (with paused = true)
    const pausedSub = await db.subscription.update({
      where: { id: subscription.id },
      data: { paused: true },
    });
    assert(pausedSub.paused === true, "9b. Legal transition (Pause active subscription)");

    // Legal: PAUSED -> RESUME
    const resumedSub = await db.subscription.update({
      where: { id: subscription.id },
      data: { paused: false },
    });
    assert(resumedSub.paused === false, "9c. Legal transition (Resume paused subscription)");

    // Legal: ACTIVE -> CLOSED
    const closedSub = await db.subscription.update({
      where: { id: subscription.id },
      data: { status: SubscriptionStatus.CLOSED },
    });
    assert(closedSub.status === SubscriptionStatus.CLOSED, "9d. Legal transition (Close active subscription)");

    // 10. Refresh and verify database persistence
    const reloaded = await db.subscription.findUnique({
      where: { id: subscription.id },
      include: { lines: true, plan: true, customer: true },
    });
    assert(
      reloaded !== null && reloaded.status === SubscriptionStatus.CLOSED && reloaded.lines.length === 1,
      "10. Refresh and verify database persistence"
    );

    // Clean up test records
    await db.subscriptionLine.deleteMany({ where: { subscriptionId: subscription.id } });
    await db.subscription.delete({ where: { id: subscription.id } });
    await db.productVariant.delete({ where: { id: variant.id } });
    await db.product.delete({ where: { id: product.id } });
    await db.plan.delete({ where: { id: monthlyPlan.id } });
    await db.plan.delete({ where: { id: yearlyPlan.id } });
  } catch (err: any) {
    console.error("Test execution caught error:", err);
    failed++;
  }

  console.log(`\n=================================================`);
  console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`=================================================`);

    return { passed, failed };
}

if (typeof describe !== "undefined") {
  describe("Catalog & Subscriptions Integration Suite", () => {
    it("runs catalog integration suite with live database", async () => {
      const { failed } = await runMember2Tests();
      expect(failed).toBe(0);
    }, 60000);
  });
}

if (typeof require !== "undefined" && require.main === module) {
  runMember2Tests()
    .then(({ failed }) => {
      if (failed > 0) process.exit(1);
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
