import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import AccountPage from "./page";

const mockUseSession = jest.fn();
const mockSignOut = jest.fn();
const mockPush = jest.fn();

jest.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
  signOut: (...args: unknown[]) => mockSignOut(...args),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/account",
}));

let mockStripeEnabled = false;

jest.mock("@/lib/auth-config", () => ({
  get STRIPE_ENABLED() { return mockStripeEnabled; },
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("AccountPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStripeEnabled = false;
    mockUseSession.mockReturnValue({
      data: { user: { id: "1", name: "Test User", email: "test@test.com" } },
      status: "authenticated",
    });
  });

  it("renders account page with profile info", async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ tier: "free", used: 0, limit: 1 }),
    });

    render(<AccountPage />);

    await waitFor(() => {
      expect(screen.getByText("Account")).toBeInTheDocument();
      expect(screen.getByText("Profile")).toBeInTheDocument();
      expect(screen.getByText("Test User")).toBeInTheDocument();
      expect(screen.getByText("test@test.com")).toBeInTheDocument();
    });
  });

  it("shows usage section when usage data available", async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ tier: "pro", used: 5, limit: 30 }),
    });

    render(<AccountPage />);

    await waitFor(() => {
      expect(screen.getByText("Usage")).toBeInTheDocument();
      expect(screen.getByText("pro")).toBeInTheDocument();
      expect(screen.getByText("5 / 30")).toBeInTheDocument();
    });
  });

  it("shows STRIPE_ENABLED subscription section", async () => {
    mockStripeEnabled = true;
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ tier: "free", used: 0, limit: 1 }),
    });

    render(<AccountPage />);

    await waitFor(() => {
      expect(screen.getByText("Subscription")).toBeInTheDocument();
      expect(screen.getByText("Manage subscription")).toBeInTheDocument();
    });
  });

  it("Sign out button calls signOut", async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ tier: "free", used: 0, limit: 1 }),
    });

    render(<AccountPage />);

    await waitFor(() => {
      expect(screen.getByText("Sign out")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Sign out"));
    expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: "/" });
  });

  it("handleManageSubscription calls portal API on success", async () => {
    mockStripeEnabled = true;
    mockFetch
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ tier: "free", used: 0, limit: 1 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ url: "https://portal.stripe.com/test" }),
      });

    render(<AccountPage />);

    await waitFor(() => {
      expect(screen.getByText("Manage subscription")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Manage subscription"));

    await waitFor(() => {
      // Verify the portal API was called
      expect(mockFetch).toHaveBeenCalledWith("/api/stripe/portal", { method: "POST" });
    });
  });

  it("handleManageSubscription shows error on failure", async () => {
    mockStripeEnabled = true;
    mockFetch
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ tier: "free", used: 0, limit: 1 }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "No subscription" }),
      });

    render(<AccountPage />);

    await waitFor(() => {
      expect(screen.getByText("Manage subscription")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Manage subscription"));

    await waitFor(() => {
      expect(screen.getByText("No subscription")).toBeInTheDocument();
    });
  });

  it("handleManageSubscription handles exception", async () => {
    mockStripeEnabled = true;
    mockFetch
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ tier: "free", used: 0, limit: 1 }),
      })
      .mockRejectedValueOnce(new Error("Network error"));

    render(<AccountPage />);

    await waitFor(() => {
      expect(screen.getByText("Manage subscription")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Manage subscription"));

    await waitFor(() => {
      expect(screen.getByText("Failed to connect to subscription portal")).toBeInTheDocument();
    });
  });

  it("shows unlimited when usage limit is null", async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ tier: "mentoring", used: 10, limit: null }),
    });

    render(<AccountPage />);

    await waitFor(() => {
      expect(screen.getByText("10 / unlimited")).toBeInTheDocument();
    });
  });

  it("shows em-dash when user has no name or email", async () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "1" } },
      status: "authenticated",
    });
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ tier: "free", used: 0, limit: 1 }),
    });

    render(<AccountPage />);

    await waitFor(() => {
      const emDashes = screen.getAllByText("\u2014");
      expect(emDashes.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("handles fetch error for usage gracefully", async () => {
    mockFetch.mockRejectedValue(new Error("Failed to fetch"));

    render(<AccountPage />);

    await waitFor(() => {
      // Usage section should not be rendered
      expect(screen.queryByText("Usage")).not.toBeInTheDocument();
    });
  });
});
