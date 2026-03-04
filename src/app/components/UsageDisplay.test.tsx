import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import UsageDisplay from "./UsageDisplay";

const mockUseSession = jest.fn();

jest.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
}));

let mockAuthEnabled = false;
let mockStripeEnabled = false;

jest.mock("@/lib/auth-config", () => ({
  get AUTH_ENABLED() { return mockAuthEnabled; },
  get STRIPE_ENABLED() { return mockStripeEnabled; },
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("UsageDisplay", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthEnabled = false;
    mockStripeEnabled = false;
  });

  it("returns null when AUTH_ENABLED=false", () => {
    mockAuthEnabled = false;
    mockUseSession.mockReturnValue({ data: { user: { id: "1" } } });

    const { container } = render(<UsageDisplay apiKey="" />);
    expect(container.innerHTML).toBe("");
  });

  it("returns null when no session", () => {
    mockAuthEnabled = true;
    mockUseSession.mockReturnValue({ data: null });

    const { container } = render(<UsageDisplay apiKey="" />);
    expect(container.innerHTML).toBe("");
  });

  it("returns null when isByok=true", () => {
    mockAuthEnabled = true;
    mockUseSession.mockReturnValue({ data: { user: { id: "1" } } });

    const { container } = render(<UsageDisplay apiKey="sk-test" />);
    expect(container.innerHTML).toBe("");
  });

  it("shows loading text while loading", () => {
    mockAuthEnabled = true;
    mockUseSession.mockReturnValue({ data: { user: { id: "1" } } });
    mockFetch.mockReturnValue(new Promise(() => {}));

    render(<UsageDisplay apiKey="" />);
    expect(screen.getByText("Loading usage...")).toBeInTheDocument();
  });

  it("shows Unlimited analyses for mentoring tier", async () => {
    mockAuthEnabled = true;
    mockUseSession.mockReturnValue({ data: { user: { id: "1" } } });
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ tier: "mentoring", used: 50, limit: null, periodStart: "2026-03-01" }),
    });

    render(<UsageDisplay apiKey="" />);

    await waitFor(() => {
      expect(screen.getByText("Unlimited analyses")).toBeInTheDocument();
    });
    expect(screen.getByText("Mentoring+")).toBeInTheDocument();
  });

  it("shows usage for pro tier", async () => {
    mockAuthEnabled = true;
    mockUseSession.mockReturnValue({ data: { user: { id: "1" } } });
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ tier: "pro", used: 5, limit: 30, periodStart: "2026-03-01" }),
    });

    render(<UsageDisplay apiKey="" />);

    await waitFor(() => {
      expect(screen.getByText("5 of 30 analyses used this month")).toBeInTheDocument();
    });
    expect(screen.getByText("Pro")).toBeInTheDocument();
  });

  it("shows singular 'analysis' for free tier (limit=1)", async () => {
    mockAuthEnabled = true;
    mockUseSession.mockReturnValue({ data: { user: { id: "1" } } });
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ tier: "free", used: 0, limit: 1, periodStart: "2026-03-01" }),
    });

    render(<UsageDisplay apiKey="" />);

    await waitFor(() => {
      expect(screen.getByText("0 of 1 analysis used this month")).toBeInTheDocument();
    });
    expect(screen.getByText("Free")).toBeInTheDocument();
  });

  it("shows Manage subscription button for pro tier when STRIPE_ENABLED", async () => {
    mockAuthEnabled = true;
    mockStripeEnabled = true;
    mockUseSession.mockReturnValue({ data: { user: { id: "1" } } });
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ tier: "pro", used: 5, limit: 30, periodStart: "2026-03-01" }),
    });

    render(<UsageDisplay apiKey="" />);

    await waitFor(() => {
      expect(screen.getByText("Manage subscription")).toBeInTheDocument();
    });
  });

  it("handleManageSubscription calls portal API on success", async () => {
    mockAuthEnabled = true;
    mockStripeEnabled = true;
    mockUseSession.mockReturnValue({ data: { user: { id: "1" } } });
    mockFetch
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ tier: "pro", used: 5, limit: 30, periodStart: "2026-03-01" }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ url: "https://portal.stripe.com/test" }),
      });

    render(<UsageDisplay apiKey="" />);

    await waitFor(() => {
      expect(screen.getByText("Manage subscription")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Manage subscription"));

    await waitFor(() => {
      // Verify the portal API was called
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenLastCalledWith("/api/stripe/portal", { method: "POST" });
    });
  });

  it("handles fetch error gracefully", async () => {
    mockAuthEnabled = true;
    mockUseSession.mockReturnValue({ data: { user: { id: "1" } } });
    mockFetch.mockRejectedValue(new Error("Network error"));

    const { container } = render(<UsageDisplay apiKey="" />);

    await waitFor(() => {
      // After error, loading is false and usage is null, returns null
      expect(container.innerHTML).toBe("");
    });
  });
});
