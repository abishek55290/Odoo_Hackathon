/**
 * Database Seed Script — Odoo Hackathon
 * ======================================
 * Run:  npm run db:seed
 *
 * Creates demo data for development/testing ONLY.
 * ⚠️  NEVER use these credentials in production.
 *
 * Accounts created:
 *   admin@demo.dev      / Admin@12345!
 *   staff@demo.dev      / Staff@12345!
 *   customer1@demo.dev  / Customer@123!
 *   customer2@demo.dev  / Customer@456!
 */

import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;

async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

async function main() {
  console.log('🌱  Starting database seed…\n');

  // ── Clean slate (safe for re-running) ──────────────────────────────────
  await prisma.invoice.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.product.deleteMany();

  console.log('   ✓ Cleared existing data');

  // ── Users ───────────────────────────────────────────────────────────────
  const [admin, staff, customer1, customer2] = await Promise.all([
    prisma.user.create({
      data: {
        email: 'admin@demo.dev',
        passwordHash: await hashPassword('Admin@12345!'),
        firstName: 'Alice',
        lastName: 'Admin',
        role: Role.ADMIN,
      },
    }),
    prisma.user.create({
      data: {
        email: 'staff@demo.dev',
        passwordHash: await hashPassword('Staff@12345!'),
        firstName: 'Sam',
        lastName: 'Staff',
        role: Role.STAFF,
      },
    }),
    prisma.user.create({
      data: {
        email: 'customer1@demo.dev',
        passwordHash: await hashPassword('Customer@123!'),
        firstName: 'Charlie',
        lastName: 'One',
        role: Role.CUSTOMER,
      },
    }),
    prisma.user.create({
      data: {
        email: 'customer2@demo.dev',
        passwordHash: await hashPassword('Customer@456!'),
        firstName: 'Diana',
        lastName: 'Two',
        role: Role.CUSTOMER,
      },
    }),
  ]);

  console.log('   ✓ Users created');
  console.table([
    { email: admin.email,     role: admin.role,     id: admin.id },
    { email: staff.email,     role: staff.role,     id: staff.id },
    { email: customer1.email, role: customer1.role, id: customer1.id },
    { email: customer2.email, role: customer2.role, id: customer2.id },
  ]);

  // ── Products ─────────────────────────────────────────────────────────────
  const [basicPlan, proPlan, enterprisePlan] = await Promise.all([
    prisma.product.create({
      data: {
        name: 'Basic Plan',
        description: 'Core features for small teams',
        priceMonthly: 29.00,
        priceAnnual: 290.00,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Professional Plan',
        description: 'Advanced features with priority support',
        priceMonthly: 79.00,
        priceAnnual: 790.00,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Enterprise Plan',
        description: 'Unlimited everything with dedicated support',
        priceMonthly: 299.00,
        priceAnnual: 2990.00,
      },
    }),
  ]);

  console.log('\n   ✓ Products created');
  console.table([
    { name: basicPlan.name,      monthly: `$${basicPlan.priceMonthly}`,      id: basicPlan.id },
    { name: proPlan.name,        monthly: `$${proPlan.priceMonthly}`,        id: proPlan.id },
    { name: enterprisePlan.name, monthly: `$${enterprisePlan.priceMonthly}`, id: enterprisePlan.id },
  ]);

  // ── Subscriptions ─────────────────────────────────────────────────────────
  const [sub1, sub2] = await Promise.all([
    prisma.subscription.create({
      data: {
        userId: customer1.id,
        productId: basicPlan.id,
        status: 'ACTIVE',
        startDate: new Date('2026-01-01'),
      },
    }),
    prisma.subscription.create({
      data: {
        userId: customer2.id,
        productId: proPlan.id,
        status: 'ACTIVE',
        startDate: new Date('2026-03-15'),
      },
    }),
  ]);

  console.log('\n   ✓ Subscriptions created');

  // ── Invoices ──────────────────────────────────────────────────────────────
  await Promise.all([
    prisma.invoice.create({
      data: {
        userId: customer1.id,
        subscriptionId: sub1.id,
        invoiceNumber: 'INV-2026-0001',
        status: 'PAID',
        amountDue: 29.00,
        amountPaid: 29.00,
        dueDate: new Date('2026-02-01'),
        paidAt: new Date('2026-01-30'),
        notes: 'January 2026 — Basic Plan',
      },
    }),
    prisma.invoice.create({
      data: {
        userId: customer2.id,
        subscriptionId: sub2.id,
        invoiceNumber: 'INV-2026-0002',
        status: 'SENT',
        amountDue: 79.00,
        amountPaid: 0,
        dueDate: new Date('2026-04-15'),
        notes: 'April 2026 — Professional Plan',
      },
    }),
    prisma.invoice.create({
      data: {
        userId: customer1.id,
        subscriptionId: sub1.id,
        invoiceNumber: 'INV-2026-0003',
        status: 'DRAFT',
        amountDue: 29.00,
        amountPaid: 0,
        dueDate: new Date('2026-11-01'),
        notes: 'November 2026 — Basic Plan',
      },
    }),
  ]);

  console.log('   ✓ Invoices created');

  console.log('\n✅  Seed complete!\n');
  console.log('Demo login credentials (DEV ONLY):');
  console.log('  ADMIN    → admin@demo.dev       / Admin@12345!');
  console.log('  STAFF    → staff@demo.dev        / Staff@12345!');
  console.log('  CUSTOMER → customer1@demo.dev   / Customer@123!');
  console.log('  CUSTOMER → customer2@demo.dev   / Customer@456!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
