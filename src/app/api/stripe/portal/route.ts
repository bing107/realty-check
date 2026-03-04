import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { stripe, STRIPE_ENABLED } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';

export async function POST() {
  if (!STRIPE_ENABLED || !stripe) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { stripeCustomerId: true },
  });

  if (!user.stripeCustomerId) {
    return NextResponse.json({ error: 'No Stripe customer found' }, { status: 400 });
  }

  const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${baseUrl}/`,
  });

  return NextResponse.json({ url: portalSession.url });
}
