/**
 * @jest-environment node
 */

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('@/lib/auth-config', () => ({
  isAuthEnabled: true,
}));

import { getUserUsage, canRunAnalysis, incrementUsage } from '@/lib/usage';
import { prisma } from '@/lib/prisma';

const mockPrisma = prisma as unknown as {
  user: {
    findUniqueOrThrow: jest.Mock;
    update: jest.Mock;
  };
};

describe('usage.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserUsage', () => {
    it('returns current usage when period is current month', async () => {
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        tier: 'free',
        analysisCount: 0,
        analysisPeriodStart: currentMonthStart,
      });

      const usage = await getUserUsage('user-1');

      expect(usage.tier).toBe('free');
      expect(usage.used).toBe(0);
      expect(usage.limit).toBe(1);
      expect(usage.periodStart).toEqual(currentMonthStart);
    });

    it('resets count when analysisPeriodStart is a previous month', async () => {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      const oldPeriodStart = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);

      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        tier: 'pro',
        analysisCount: 15,
        analysisPeriodStart: oldPeriodStart,
      });
      mockPrisma.user.update.mockResolvedValue({});

      const usage = await getUserUsage('user-1');

      expect(usage.used).toBe(0);
      expect(usage.tier).toBe('pro');
      expect(usage.limit).toBe(30);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({
            analysisCount: 0,
          }),
        })
      );
    });

    it('returns correct limit for mentoring tier', async () => {
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        tier: 'mentoring',
        analysisCount: 100,
        analysisPeriodStart: currentMonthStart,
      });

      const usage = await getUserUsage('user-1');

      expect(usage.tier).toBe('mentoring');
      expect(usage.limit).toBe(Infinity);
      expect(usage.used).toBe(100);
    });

    it('defaults to limit of 1 for unknown tier', async () => {
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        tier: 'unknown-tier',
        analysisCount: 0,
        analysisPeriodStart: currentMonthStart,
      });

      const usage = await getUserUsage('user-1');

      expect(usage.limit).toBe(1);
    });
  });

  describe('canRunAnalysis', () => {
    it('always allows BYOK (bring your own key)', async () => {
      // Should not even call prisma
      const result = await canRunAnalysis('user-1', true);

      expect(result.allowed).toBe(true);
      expect(mockPrisma.user.findUniqueOrThrow).not.toHaveBeenCalled();
    });

    it('allows free tier when used=0', async () => {
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        tier: 'free',
        analysisCount: 0,
        analysisPeriodStart: currentMonthStart,
      });

      const result = await canRunAnalysis('user-1', false);

      expect(result.allowed).toBe(true);
    });

    it('blocks free tier when used>=1', async () => {
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        tier: 'free',
        analysisCount: 1,
        analysisPeriodStart: currentMonthStart,
      });

      const result = await canRunAnalysis('user-1', false);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('1 analysis');
      expect(result.tier).toBe('free');
      expect(result.used).toBe(1);
      expect(result.limit).toBe(1);
    });

    it('allows pro tier when used<30', async () => {
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        tier: 'pro',
        analysisCount: 29,
        analysisPeriodStart: currentMonthStart,
      });

      const result = await canRunAnalysis('user-1', false);

      expect(result.allowed).toBe(true);
    });

    it('blocks pro tier when used>=30', async () => {
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        tier: 'pro',
        analysisCount: 30,
        analysisPeriodStart: currentMonthStart,
      });

      const result = await canRunAnalysis('user-1', false);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('30 analysis');
      expect(result.tier).toBe('pro');
      expect(result.used).toBe(30);
      expect(result.limit).toBe(30);
    });

    it('always allows mentoring tier', async () => {
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        tier: 'mentoring',
        analysisCount: 9999,
        analysisPeriodStart: currentMonthStart,
      });

      const result = await canRunAnalysis('user-1', false);

      expect(result.allowed).toBe(true);
    });
  });

  describe('incrementUsage', () => {
    it('increments count when period is current month', async () => {
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        analysisPeriodStart: currentMonthStart,
      });
      mockPrisma.user.update.mockResolvedValue({});

      await incrementUsage('user-1');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          analysisCount: { increment: 1 },
        },
      });
    });

    it('resets to 1 when period is stale', async () => {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        analysisPeriodStart: new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1),
      });
      mockPrisma.user.update.mockResolvedValue({});

      await incrementUsage('user-1');

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({
            analysisCount: 1,
          }),
        })
      );
    });
  });
});
