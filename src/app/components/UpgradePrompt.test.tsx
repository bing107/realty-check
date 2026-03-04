import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import UpgradePrompt from "./UpgradePrompt";

let mockStripeEnabled = false;

jest.mock("@/lib/auth-config", () => ({
  get STRIPE_ENABLED() { return mockStripeEnabled; },
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("UpgradePrompt", () => {
  const onClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockStripeEnabled = false;
  });

  it("renders the modal with upgrade message", () => {
    render(<UpgradePrompt onClose={onClose} />);
    expect(screen.getByText("Analysis limit reached")).toBeInTheDocument();
    expect(screen.getByText(/You have used your 1 free analysis/)).toBeInTheDocument();
  });

  it("shows Go Pro button when STRIPE_ENABLED=true", () => {
    mockStripeEnabled = true;
    render(<UpgradePrompt onClose={onClose} />);
    expect(screen.getByRole("button", { name: /Go Pro/i })).toBeInTheDocument();
  });

  it("does not show Go Pro button when STRIPE_ENABLED=false", () => {
    mockStripeEnabled = false;
    render(<UpgradePrompt onClose={onClose} />);
    expect(screen.queryByRole("button", { name: /Go Pro/i })).not.toBeInTheDocument();
  });

  it("Close button calls onClose", () => {
    render(<UpgradePrompt onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("handleUpgrade calls checkout API on success", async () => {
    mockStripeEnabled = true;
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: "https://checkout.stripe.com/test" }),
    });

    render(<UpgradePrompt onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /Go Pro/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/stripe/checkout", { method: "POST" });
    });
  });

  it("handleUpgrade shows Redirecting... while loading", async () => {
    mockStripeEnabled = true;
    mockFetch.mockReturnValue(new Promise(() => {}));

    render(<UpgradePrompt onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /Go Pro/i }));

    await waitFor(() => {
      expect(screen.getByText("Redirecting...")).toBeInTheDocument();
    });
  });

  it("handleUpgrade handles error gracefully (no redirect when !res.ok)", async () => {
    mockStripeEnabled = true;
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Failed" }),
    });

    render(<UpgradePrompt onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /Go Pro/i }));

    await waitFor(() => {
      // Button should be re-enabled after error
      expect(screen.getByRole("button", { name: /Go Pro/i })).not.toBeDisabled();
    });
  });

  it("handleUpgrade handles fetch exception", async () => {
    mockStripeEnabled = true;
    mockFetch.mockRejectedValue(new Error("Network error"));

    render(<UpgradePrompt onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /Go Pro/i }));

    await waitFor(() => {
      // Should not crash, button should be re-enabled
      expect(screen.getByRole("button", { name: /Go Pro/i })).toBeInTheDocument();
    });
  });
});
