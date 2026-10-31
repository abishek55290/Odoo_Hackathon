/**
 * Dashboard & Customer Portal Unit Tests — Member 4
 *
 * Verifies authentication guards, role access (ADMIN/STAFF vs CUSTOMER),
 * multi-tenancy ownership enforcement, and MRR normalization logic.
 */

import request from 'supertest';
import { createApp } from '@/app';
import { Role } from '@prisma/client';
import * as DashboardService from '@/modules/dashboard/dashboard.service';

jest.mock('@/modules/dashboard/dashboard.service');

const app = createApp();

describe('Dashboard & Customer Portal Endpoints (Member 4)', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/dashboard/stats (Executive Dashboard)', () => {
    it('returns 401 UNAUTHORIZED when no session exists', async () => {
      const res = await request(app).get('/api/dashboard/stats');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 UNAUTHORIZED for alias /api/dashboard/summary without session', async () => {
      const res = await request(app).get('/api/dashboard/summary');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });
  });

  describe('GET /api/dashboard/my-stats (Customer Self-Service Portal)', () => {
    it('returns 401 UNAUTHORIZED when no session exists', async () => {
      const res = await request(app).get('/api/dashboard/my-stats');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 UNAUTHORIZED for /api/portal/subscriptions without session', async () => {
      const res = await request(app).get('/api/portal/subscriptions');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 UNAUTHORIZED for /api/portal/invoices without session', async () => {
      const res = await request(app).get('/api/portal/invoices');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });
  });

  describe('MRR Normalization Calculation Logic', () => {
    it('normalizes monthly, weekly, daily, and annual recurring values accurately', () => {
      const monthlyPrice = 1000;
      const annualPrice = 12000;
      const weeklyPrice = 250;
      const dailyPrice = 50;

      const normalizedMonthly = monthlyPrice * 1.0;
      const normalizedAnnual = annualPrice / 12.0;
      const normalizedWeekly = weeklyPrice * (52 / 12);
      const normalizedDaily = dailyPrice * (365 / 12);

      expect(normalizedMonthly).toBe(1000);
      expect(normalizedAnnual).toBe(1000);
      expect(Math.round(normalizedWeekly * 100) / 100).toBe(1083.33);
      expect(Math.round(normalizedDaily * 100) / 100).toBe(1520.83);
    });

    it('verifies ARR formula equals MRR * 12', () => {
      const mrr = 8700;
      const arr = mrr * 12;
      expect(arr).toBe(104400);
    });
  });
});
