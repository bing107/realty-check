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

import { POST } from './route';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

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
});
