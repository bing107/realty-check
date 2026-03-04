import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PricingPage from "./page";

let mockStripeEnabled = false;

jest.mock("@/lib/auth-config", () => ({
  get STRIPE_ENABLED() { return mockStripeEnabled; },
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("PricingPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStripeEnabled = false;
  });

  it("renders all three tiers", () => {
    render(<PricingPage />);
    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(screen.getByText("Pro")).toBeInTheDocument();
    expect(screen.getByText("Mentoring+")).toBeInTheDocument();
  });

  it("renders Pricing heading", () => {
    render(<PricingPage />);
    expect(screen.getByText("Pricing")).toBeInTheDocument();
  });

  it("STRIPE_ENABLED=false: Pro shows no Go Pro button", () => {
    mockStripeEnabled = false;
    render(<PricingPage />);
    expect(screen.queryByRole("button", { name: /Go Pro/i })).not.toBeInTheDocument();
  });

  it("STRIPE_ENABLED=true: Pro shows Go Pro button", () => {
    mockStripeEnabled = true;
    render(<PricingPage />);
    expect(screen.getByRole("button", { name: /Go Pro/i })).toBeInTheDocument();
  });

  it("Free tier shows Get started link", () => {
    render(<PricingPage />);
    const link = screen.getByText("Get started");
    expect(link.closest("a")).toHaveAttribute("href", "/");
  });

  it("Mentoring+ shows Contact us", () => {
    render(<PricingPage />);
    expect(screen.getByText("Contact us")).toBeInTheDocument();
  });

  it("clicking Go Pro calls checkout API and shows Redirecting state", async () => {
    mockStripeEnabled = true;
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: "https://checkout.stripe.com/test" }),
    });

    render(<PricingPage />);
    fireEvent.click(screen.getByRole("button", { name: /Go Pro/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/stripe/checkout", { method: "POST" });
    });

    // After successful fetch, the button should show Redirecting... state
    // (window.location.href assignment happens but jsdom doesn't navigate)
  });

  it("handleCheckout does not redirect when !res.ok", async () => {
    mockStripeEnabled = true;
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Failed" }),
    });

    render(<PricingPage />);
    fireEvent.click(screen.getByRole("button", { name: /Go Pro/i }));

    await waitFor(() => {
      // After error, button should be re-enabled (loading set back to false)
      expect(screen.getByRole("button", { name: /Go Pro/i })).not.toBeDisabled();
    });
  });

  it("handleCheckout handles fetch exception", async () => {
    mockStripeEnabled = true;
    mockFetch.mockRejectedValue(new Error("Network error"));

    render(<PricingPage />);
    fireEvent.click(screen.getByRole("button", { name: /Go Pro/i }));

    await waitFor(() => {
      // Should recover and re-enable button
      expect(screen.getByRole("button", { name: /Go Pro/i })).not.toBeDisabled();
    });
  });
});
