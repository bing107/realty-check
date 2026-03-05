/**
 * @jest-environment node
 */

let mockPortalStripeEnabled = true;
const mockStripeObj = {
  billingPortal: {
    sessions: {
      create: jest.fn(),
    },
  },
};

jest.mock("@/auth", () => ({
  auth: jest.fn(),
}));

jest.mock("@/lib/stripe", () => ({
  get STRIPE_ENABLED() {
    return mockPortalStripeEnabled;
  },
  get stripe() {
    return mockPortalStripeEnabled ? mockStripeObj : null;
  },
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUniqueOrThrow: jest.fn(),
    },
  },
}));

import { POST } from "./route";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const mockAuth = auth as jest.Mock;
const mockPrisma = prisma as unknown as {
  user: {
    findUniqueOrThrow: jest.Mock;
  };
};

describe("POST /api/stripe/portal", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPortalStripeEnabled = true;
    process.env = { ...originalEnv };
    process.env.NEXTAUTH_URL = "http://localhost:3000";
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns 503 when STRIPE_ENABLED=false", async () => {
    mockPortalStripeEnabled = false;

    const res = await POST();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("Stripe not configured");
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const res = await POST();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 400 when user has no stripeCustomerId", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
      stripeCustomerId: null,
    });

    const res = await POST();
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("No Stripe customer found");
  });

  it("returns url on success", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
      stripeCustomerId: "cus_123",
    });
    mockStripeObj.billingPortal.sessions.create.mockResolvedValue({
      url: "https://billing.stripe.com/portal-session",
    });

    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe("https://billing.stripe.com/portal-session");

    expect(mockStripeObj.billingPortal.sessions.create).toHaveBeenCalledWith({
      customer: "cus_123",
      return_url: "http://localhost:3000/account",
    });
  });

  it("uses localhost:3000 fallback when neither NEXTAUTH_URL nor VERCEL_URL is set (line 26)", async () => {
    delete process.env.NEXTAUTH_URL;
    delete process.env.VERCEL_URL;

    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
      stripeCustomerId: "cus_123",
    });
    mockStripeObj.billingPortal.sessions.create.mockResolvedValue({
      url: "https://billing.stripe.com/portal-session-local",
    });

    const res = await POST();
    expect(res.status).toBe(200);

    expect(mockStripeObj.billingPortal.sessions.create).toHaveBeenCalledWith({
      customer: "cus_123",
      return_url: "http://localhost:3000/account",
    });
  });

  it("uses VERCEL_URL when NEXTAUTH_URL is not set", async () => {
    delete process.env.NEXTAUTH_URL;
    process.env.VERCEL_URL = "my-app.vercel.app";

    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
      stripeCustomerId: "cus_123",
    });
    mockStripeObj.billingPortal.sessions.create.mockResolvedValue({
      url: "https://billing.stripe.com/portal-session",
    });

    const res = await POST();
    expect(res.status).toBe(200);

    expect(mockStripeObj.billingPortal.sessions.create).toHaveBeenCalledWith({
      customer: "cus_123",
      return_url: "https://my-app.vercel.app/account",
    });
  });
});
