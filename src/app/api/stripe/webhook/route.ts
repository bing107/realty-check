import { NextRequest, NextResponse } from 'next/server';
import { stripe, STRIPE_ENABLED } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import type Stripe from 'stripe';

/**
 * In Stripe API 2025-01-27.acacia (SDK v17+), current_period_end moved
 * from the Subscription object to SubscriptionItem. Extract it from items.
 */
function getPeriodEnd(subscription: Stripe.Subscription): Date | null {
  const item = subscription.items?.data?.[0];
  if (item?.current_period_end) {
    return new Date(item.current_period_end * 1000);
  }
  return null;
}

export async function POST(req: NextRequest) {
  if (!STRIPE_ENABLED || !stripe) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 503 });
  }

  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook signature verification failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== 'subscription') break;

      const customerId = typeof session.customer === 'string'
        ? session.customer
        : session.customer?.id;
      const subscriptionId = typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id;

      if (!customerId || !subscriptionId) break;

      // Retrieve subscription to get period end from items
      const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['items.data'],
      });
      const periodEnd = getPeriodEnd(subscription);

      // Try to find user by stripeCustomerId first, then by email
      let user = await prisma.user.findUnique({
        where: { stripeCustomerId: customerId },
      });

      if (!user && session.customer_email) {
        user = await prisma.user.findUnique({
          where: { email: session.customer_email },
        });
      }

      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            tier: 'pro',
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            stripeCurrentPeriodEnd: periodEnd,
          },
        });
      }
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer?.id;

      // Find user by stripeCustomerId or stripeSubscriptionId
      let user = customerId
        ? await prisma.user.findUnique({ where: { stripeCustomerId: customerId } })
        : null;

      if (!user) {
        user = await prisma.user.findUnique({
          where: { stripeSubscriptionId: subscription.id },
        });
      }

      if (user) {
        const isActive = subscription.status === 'active' || subscription.status === 'trialing';
        const periodEnd = getPeriodEnd(subscription);
        await prisma.user.update({
          where: { id: user.id },
          data: {
            tier: isActive ? 'pro' : 'free',
            stripeCurrentPeriodEnd: periodEnd,
          },
        });
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;

      const user = await prisma.user.findUnique({
        where: { stripeSubscriptionId: subscription.id },
      });

      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            tier: 'free',
            stripeSubscriptionId: null,
            stripeCurrentPeriodEnd: null,
          },
        });
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
