/**
 * @jest-environment node
 */

let mockStripeEnabled = true;
const mockStripeObj = {
  customers: {
    create: jest.fn(),
  },
  checkout: {
    sessions: {
      create: jest.fn(),
    },
  },
};

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/stripe', () => ({
  get STRIPE_ENABLED() {
    return mockStripeEnabled;
  },
  get stripe() {
    return mockStripeEnabled ? mockStripeObj : null;
  },
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('@/lib/posthog-server', () => ({
  serverTrack: jest.fn().mockResolvedValue(undefined),
}));

import { POST } from './route';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { serverTrack } from '@/lib/posthog-server';

const mockServerTrack = serverTrack as jest.Mock;

const mockAuth = auth as jest.Mock;
const mockPrisma = prisma as unknown as {
  user: {
    findUniqueOrThrow: jest.Mock;
    update: jest.Mock;
  };
};

describe('POST /api/stripe/checkout', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    mockStripeEnabled = true;
    process.env = { ...originalEnv };
    process.env.STRIPE_PRO_PRICE_ID = 'price_test_123';
    process.env.NEXTAUTH_URL = 'http://localhost:3000';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns 503 when Stripe is not enabled', async () => {
    mockStripeEnabled = false;

    const res = await POST();
    expect(res.status).toBe(503);

    const body = await res.json();
    expect(body.error).toBe('Stripe not configured');
  });

  it('returns 401 when no session', async () => {
    mockAuth.mockResolvedValue(null);

    const res = await POST();
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 401 when session has no email', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });

    const res = await POST();
    expect(res.status).toBe(401);
  });

  it('returns 401 when session has no user id (line 26)', async () => {
    mockAuth.mockResolvedValue({ user: { email: 'no-id@test.com' } });

    const res = await POST();
    expect(res.status).toBe(401);
  });

  it('uses VERCEL_URL as base when NEXTAUTH_URL is not set (lines 41-42)', async () => {
    delete process.env.NEXTAUTH_URL;
    process.env.VERCEL_URL = 'my-app.vercel.app';

    mockAuth.mockResolvedValue({
      user: { id: 'user-1', email: 'test@example.com' },
    });
    mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
      stripeCustomerId: 'cus_existing',
      email: 'test@example.com',
    });
    mockStripeObj.checkout.sessions.create.mockResolvedValue({
      url: 'https://checkout.stripe.com/session_test',
    });

    const res = await POST();
    expect(res.status).toBe(200);

    expect(mockStripeObj.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        success_url: 'https://my-app.vercel.app/analyze?checkout=success',
        cancel_url: 'https://my-app.vercel.app/pricing',
      })
    );
  });

  it('creates a new Stripe customer when user has no stripeCustomerId', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', email: 'test@example.com' },
    });
    mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
      stripeCustomerId: null,
      email: 'test@example.com',
    });
    mockStripeObj.customers.create.mockResolvedValue({ id: 'cus_new_123' });
    mockPrisma.user.update.mockResolvedValue({});
    mockStripeObj.checkout.sessions.create.mockResolvedValue({
      url: 'https://checkout.stripe.com/session_123',
    });

    const res = await POST();
    expect(res.status).toBe(200);

    expect(mockStripeObj.customers.create).toHaveBeenCalledWith({
      email: 'test@example.com',
      metadata: { userId: 'user-1' },
    });
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { stripeCustomerId: 'cus_new_123' },
    });
  });

  it('returns checkout URL when user already has stripeCustomerId', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', email: 'test@example.com' },
    });
    mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
      stripeCustomerId: 'cus_existing_456',
      email: 'test@example.com',
    });
    mockStripeObj.checkout.sessions.create.mockResolvedValue({
      url: 'https://checkout.stripe.com/session_456',
    });

    const res = await POST();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.url).toBe('https://checkout.stripe.com/session_456');

    expect(mockStripeObj.customers.create).not.toHaveBeenCalled();
  });

  it('returns 503 when STRIPE_PRO_PRICE_ID is not set', async () => {
    delete process.env.STRIPE_PRO_PRICE_ID;

    mockAuth.mockResolvedValue({
      user: { id: 'user-1', email: 'test@example.com' },
    });
    mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
      stripeCustomerId: 'cus_existing_456',
      email: 'test@example.com',
    });

    const res = await POST();
    expect(res.status).toBe(503);

    const body = await res.json();
    expect(body.error).toBe('Stripe price not configured');
  });

  describe('PostHog tracking', () => {
    it('calls serverTrack with stripe_checkout_started on success', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'user-1', email: 'test@example.com' },
      });
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        stripeCustomerId: 'cus_existing_456',
        email: 'test@example.com',
      });
      mockStripeObj.checkout.sessions.create.mockResolvedValue({
        url: 'https://checkout.stripe.com/session_789',
      });

      const res = await POST();
      expect(res.status).toBe(200);

      expect(mockServerTrack).toHaveBeenCalledWith('user-1', 'stripe_checkout_started', {
        user_id: 'user-1',
        target_tier: 'pro',
      });
    });

    it('does not call serverTrack when user is unauthorized', async () => {
      mockAuth.mockResolvedValue(null);

      const res = await POST();
      expect(res.status).toBe(401);

      expect(mockServerTrack).not.toHaveBeenCalled();
    });

    it('does not call serverTrack when Stripe is disabled', async () => {
      mockStripeEnabled = false;

      const res = await POST();
      expect(res.status).toBe(503);

      expect(mockServerTrack).not.toHaveBeenCalled();
    });
  });
});
