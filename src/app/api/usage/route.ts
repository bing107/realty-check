import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAuthEnabled } from '@/lib/auth-config';
import { getUserUsage } from '@/lib/usage';

export async function GET() {
  if (!isAuthEnabled) {
    return NextResponse.json({ error: 'Auth not enabled' }, { status: 503 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const usage = await getUserUsage(session.user.id);

  return NextResponse.json({
    tier: usage.tier,
    used: usage.used,
    limit: usage.limit === Infinity ? null : usage.limit,
    periodStart: usage.periodStart.toISOString(),
  });
}
