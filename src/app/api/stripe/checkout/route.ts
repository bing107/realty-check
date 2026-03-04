import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { stripe, STRIPE_ENABLED } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';

export async function POST() {
  if (!STRIPE_ENABLED || !stripe) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }

  const session = await auth();
  if (!session?.user?.id || !session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { stripeCustomerId: true, email: true },
  });

  let customerId = user.stripeCustomerId;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? session.user.email,
      metadata: { userId: session.user.id },
    });
    customerId = customer.id;
    await prisma.user.update({
      where: { id: session.user.id },
      data: { stripeCustomerId: customerId },
    });
  }

  const priceId = process.env.STRIPE_PRO_PRICE_ID;
  if (!priceId) {
    return NextResponse.json({ error: 'Stripe price not configured' }, { status: 503 });
  }

  const baseUrl = process.env.NEXTAUTH_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/?checkout=success`,
    cancel_url: `${baseUrl}/`,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
