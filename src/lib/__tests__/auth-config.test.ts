/**
 * @jest-environment node
 */

describe("auth-config", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("isAuthEnabled is true when both NEXTAUTH_SECRET and DATABASE_URL are set", async () => {
    process.env.NEXTAUTH_SECRET = "test-secret";
    process.env.DATABASE_URL = "postgresql://test";

    const { isAuthEnabled } = await import("@/lib/auth-config");
    expect(isAuthEnabled).toBe(true);
  });

  it("isAuthEnabled is false when NEXTAUTH_SECRET is missing", async () => {
    delete process.env.NEXTAUTH_SECRET;
    process.env.DATABASE_URL = "postgresql://test";

    const { isAuthEnabled } = await import("@/lib/auth-config");
    expect(isAuthEnabled).toBe(false);
  });

  it("isAuthEnabled is false when DATABASE_URL is missing", async () => {
    process.env.NEXTAUTH_SECRET = "test-secret";
    delete process.env.DATABASE_URL;

    const { isAuthEnabled } = await import("@/lib/auth-config");
    expect(isAuthEnabled).toBe(false);
  });

  it('AUTH_ENABLED is true when NEXT_PUBLIC_AUTH_ENABLED==="true"', async () => {
    process.env.NEXT_PUBLIC_AUTH_ENABLED = "true";

    const { AUTH_ENABLED } = await import("@/lib/auth-config");
    expect(AUTH_ENABLED).toBe(true);
  });

  it("AUTH_ENABLED is false when NEXT_PUBLIC_AUTH_ENABLED is not set", async () => {
    delete process.env.NEXT_PUBLIC_AUTH_ENABLED;

    const { AUTH_ENABLED } = await import("@/lib/auth-config");
    expect(AUTH_ENABLED).toBe(false);
  });

  it('STRIPE_ENABLED is true when NEXT_PUBLIC_STRIPE_ENABLED==="true"', async () => {
    process.env.NEXT_PUBLIC_STRIPE_ENABLED = "true";

    const { STRIPE_ENABLED } = await import("@/lib/auth-config");
    expect(STRIPE_ENABLED).toBe(true);
  });

  it("STRIPE_ENABLED is false when NEXT_PUBLIC_STRIPE_ENABLED is not set", async () => {
    delete process.env.NEXT_PUBLIC_STRIPE_ENABLED;

    const { STRIPE_ENABLED } = await import("@/lib/auth-config");
    expect(STRIPE_ENABLED).toBe(false);
  });
});
