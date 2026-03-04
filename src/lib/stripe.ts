import Stripe from 'stripe';

export const STRIPE_ENABLED = !!(process.env.STRIPE_SECRET_KEY);

export const stripe = STRIPE_ENABLED
  ? new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-01-27.acacia' as Stripe.LatestApiVersion })
  : null;
