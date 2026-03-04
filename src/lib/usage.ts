import { prisma } from '@/lib/prisma';

const TIER_LIMITS: Record<string, number> = {
  free: 1,
  pro: 30,
  mentoring: Infinity,
};

function getStartOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export interface UsageInfo {
  tier: string;
  used: number;
  limit: number;
  periodStart: Date;
}

export async function getUserUsage(userId: string): Promise<UsageInfo> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      tier: true,
      analysisCount: true,
      analysisPeriodStart: true,
    },
  });

  const monthStart = getStartOfCurrentMonth();

  // Reset count if period start is before the current calendar month
  if (user.analysisPeriodStart < monthStart) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        analysisCount: 0,
        analysisPeriodStart: monthStart,
      },
    });
    return {
      tier: user.tier,
      used: 0,
      limit: TIER_LIMITS[user.tier] ?? 1,
      periodStart: monthStart,
    };
  }

  return {
    tier: user.tier,
    used: user.analysisCount,
    limit: TIER_LIMITS[user.tier] ?? 1,
    periodStart: user.analysisPeriodStart,
  };
}

export async function incrementUsage(userId: string): Promise<void> {
  const monthStart = getStartOfCurrentMonth();

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { analysisPeriodStart: true },
  });

  // If period is stale, reset then increment
  if (user.analysisPeriodStart < monthStart) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        analysisCount: 1,
        analysisPeriodStart: monthStart,
      },
    });
  } else {
    await prisma.user.update({
      where: { id: userId },
      data: {
        analysisCount: { increment: 1 },
      },
    });
  }
}

export async function canRunAnalysis(
  userId: string,
  byok: boolean
): Promise<{ allowed: boolean; reason?: string; tier?: string; used?: number; limit?: number }> {
  if (byok) {
    return { allowed: true };
  }

  const usage = await getUserUsage(userId);

  if (usage.used < usage.limit) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `You have used all ${usage.limit} analysis${usage.limit === 1 ? '' : 'es'} for this month.`,
    tier: usage.tier,
    used: usage.used,
    limit: usage.limit,
  };
}
