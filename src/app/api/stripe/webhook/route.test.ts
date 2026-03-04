/**
 * @jest-environment node
 */

jest.mock('@/lib/stripe', () => ({
  STRIPE_ENABLED: true,
  stripe: {
    webhooks: {
      constructEvent: jest.fn(),
    },
    subscriptions: {
      retrieve: jest.fn(),
    },
  },
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import { POST } from './route';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';

const mockPrisma = prisma as unknown as {
  user: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
};

const mockStripe = stripe as unknown as {
  webhooks: { constructEvent: jest.Mock };
  subscriptions: { retrieve: jest.Mock };
};

function makeWebhookRequest(body: string, signature: string | null = 'sig_test') {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (signature) {
    headers.set('stripe-signature', signature);
  }
  return new NextRequest('http://localhost/api/stripe/webhook', {
    method: 'POST',
    body,
    headers,
  });
}

describe('POST /api/stripe/webhook', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns 400 when stripe-signature header is missing', async () => {
    const req = makeWebhookRequest('{}', null);
    const res = await POST(req);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toBe('Missing stripe-signature header');
  });

  it('returns 400 when webhook signature verification fails', async () => {
    mockStripe.webhooks.constructEvent.mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    const req = makeWebhookRequest('{}', 'bad_signature');
    const res = await POST(req);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toBe('Invalid signature');
  });

  it('handles checkout.session.completed and upgrades user to pro', async () => {
    const mockEvent = {
      type: 'checkout.session.completed',
      data: {
        object: {
          mode: 'subscription',
          customer: 'cus_123',
          subscription: 'sub_456',
          customer_email: 'user@example.com',
        },
      },
    };

    mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
    mockStripe.subscriptions.retrieve.mockResolvedValue({
      items: {
        data: [{ current_period_end: 1735689600 }],
      },
    });
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      stripeCustomerId: 'cus_123',
    });
    mockPrisma.user.update.mockResolvedValue({});

    const req = makeWebhookRequest(JSON.stringify(mockEvent));
    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        tier: 'pro',
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_456',
        stripeCurrentPeriodEnd: new Date(1735689600 * 1000),
      },
    });
  });

  it('handles checkout.session.completed by finding user via email fallback', async () => {
    const mockEvent = {
      type: 'checkout.session.completed',
      data: {
        object: {
          mode: 'subscription',
          customer: 'cus_new',
          subscription: 'sub_789',
          customer_email: 'fallback@example.com',
        },
      },
    };

    mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
    mockStripe.subscriptions.retrieve.mockResolvedValue({
      items: {
        data: [{ current_period_end: 1735689600 }],
      },
    });
    // First lookup by stripeCustomerId returns null
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    // Second lookup by email returns user
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-2',
      email: 'fallback@example.com',
    });
    mockPrisma.user.update.mockResolvedValue({});

    const req = makeWebhookRequest(JSON.stringify(mockEvent));
    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-2' },
        data: expect.objectContaining({
          tier: 'pro',
          stripeCustomerId: 'cus_new',
          stripeSubscriptionId: 'sub_789',
        }),
      })
    );
  });

  it('skips checkout.session.completed when mode is not subscription', async () => {
    const mockEvent = {
      type: 'checkout.session.completed',
      data: {
        object: {
          mode: 'payment',
          customer: 'cus_123',
          subscription: null,
        },
      },
    };

    mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

    const req = makeWebhookRequest(JSON.stringify(mockEvent));
    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('handles customer.subscription.deleted and downgrades user to free', async () => {
    const mockEvent = {
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_to_delete',
          customer: 'cus_123',
        },
      },
    };

    mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      stripeSubscriptionId: 'sub_to_delete',
    });
    mockPrisma.user.update.mockResolvedValue({});

    const req = makeWebhookRequest(JSON.stringify(mockEvent));
    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        tier: 'free',
        stripeSubscriptionId: null,
        stripeCurrentPeriodEnd: null,
      },
    });
  });

  it('handles customer.subscription.updated with active status', async () => {
    const mockEvent = {
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_update',
          customer: 'cus_123',
          status: 'active',
          items: {
            data: [{ current_period_end: 1738368000 }],
          },
        },
      },
    };

    mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      stripeCustomerId: 'cus_123',
    });
    mockPrisma.user.update.mockResolvedValue({});

    const req = makeWebhookRequest(JSON.stringify(mockEvent));
    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        tier: 'pro',
        stripeCurrentPeriodEnd: new Date(1738368000 * 1000),
      },
    });
  });

  it('handles customer.subscription.updated with canceled status (downgrades to free)', async () => {
    const mockEvent = {
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_canceled',
          customer: 'cus_123',
          status: 'canceled',
          items: {
            data: [{ current_period_end: 1738368000 }],
          },
        },
      },
    };

    mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      stripeCustomerId: 'cus_123',
    });
    mockPrisma.user.update.mockResolvedValue({});

    const req = makeWebhookRequest(JSON.stringify(mockEvent));
    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        tier: 'free',
        stripeCurrentPeriodEnd: new Date(1738368000 * 1000),
      },
    });
  });

  it('returns 503 when webhook secret is not configured', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;

    const req = makeWebhookRequest('{}');
    const res = await POST(req);
    expect(res.status).toBe(503);

    const body = await res.json();
    expect(body.error).toBe('Webhook secret not configured');
  });

  it('gracefully handles when no user is found for checkout.session.completed', async () => {
    const mockEvent = {
      type: 'checkout.session.completed',
      data: {
        object: {
          mode: 'subscription',
          customer: 'cus_unknown',
          subscription: 'sub_unknown',
          customer_email: null,
        },
      },
    };

    mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
    mockStripe.subscriptions.retrieve.mockResolvedValue({
      items: { data: [{ current_period_end: 1735689600 }] },
    });
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const req = makeWebhookRequest(JSON.stringify(mockEvent));
    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.received).toBe(true);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });
});
