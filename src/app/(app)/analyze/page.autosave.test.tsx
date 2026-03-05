/**
 * Tests for the auto-save path in analyze/page.tsx
 * Uses AUTH_ENABLED=true with an authenticated session
 */
import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";

let capturedOnFilesChange2: ((files: File[]) => void) = () => {};

jest.mock("next-auth/react", () => ({
  useSession: () => ({
    data: { user: { id: "user-123", email: "test@test.com" } },
    status: "authenticated",
  }),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/analyze",
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

jest.mock("@/lib/auth-config", () => ({
  AUTH_ENABLED: true,
  STRIPE_ENABLED: false,
}));

jest.mock("@/lib/analytics", () => ({ track: jest.fn() }));

jest.mock("@/lib/pdf-extract", () => ({
  extractTextFromPdf: jest.fn().mockResolvedValue({
    filename: "auto.pdf",
    text: "Extracted text",
    pages: 1,
    isScanned: false,
  }),
}));

jest.mock("@/app/components/UploadZone", () => ({
  __esModule: true,
  default: ({ onFilesChange }: { onFilesChange: (f: File[]) => void }) => {
    capturedOnFilesChange2 = onFilesChange;
    return <div data-testid="upload-zone2">UploadZone</div>;
  },
}));
jest.mock("@/app/components/ApiKeyInput", () => ({
  __esModule: true,
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <input data-testid="api-key-input2" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));
jest.mock("@/app/components/ResultsDashboard", () => ({
  __esModule: true,
  default: () => <div data-testid="results-dashboard2">ResultsDashboard</div>,
}));
jest.mock("@/app/components/UsageDisplay", () => ({
  __esModule: true,
  default: () => <div data-testid="usage-display">UsageDisplay</div>,
}));
jest.mock("@/app/components/UpgradePrompt", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/app/components/WizardStepIndicator", () => ({
  __esModule: true,
  default: ({ currentStep }: { currentStep: string }) => (
    <div data-testid="wizard-step2">{currentStep}</div>
  ),
}));

import AnalyzePage from "./page";

const validAnalysis = {
  property: { address: "123 Main St", sqm: 75, units: 12, yearBuilt: 1985, type: "ETW" },
  financials: {
    purchasePrice: 250000, hausgeld: 350, ruecklage: 50,
    currentRent: 800, expectedRent: 900,
    grunderwerbsteuer: 15000, notarFees: 5000, maklerFees: 8000,
  },
  protocols: { upcomingRenovations: [], sonderumlagen: [], maintenanceBacklog: [], disputes: [] },
  wirtschaftsplan: { annualBudget: 42000, reserveFundStatus: "adequate", plannedMajorWorks: [] },
  redFlags: [],
  summary: "Decent investment.",
};

const validMetrics = {
  grossRentalYield: 4.32, netRentalYield: 2.37, totalAcquisitionCost: 278000,
  monthlyMortgagePayment: 926.13, monthlyCashFlow: -376.13, pricePerSqm: 3333.33,
  renovationReserveAdequacy: { adequate: true, message: "OK" },
  breakEvenYears: null,
  assumptions: { mortgageRate: 0.035, downPayment: 0.2, loanTermYears: 25 },
};

describe("AnalyzePage (auto-save path)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it("auto-saves analysis when AUTH_ENABLED=true and user is logged in", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ analysis: validAnalysis }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ metrics: validMetrics }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          investmentSummary: "Great property!",
          priceComparison: null,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "saved-123" }),
      }); // auto-save call

    render(<AnalyzePage />);

    const file = new File(["content"], "auto.pdf", { type: "application/pdf" });
    act(() => { capturedOnFilesChange2([file]); });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Analyze Documents" }));
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Analyze with AI" })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Analyze with AI" }));
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Generate Full Report" })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Generate Full Report" }));
    });

    await waitFor(() => {
      expect(screen.getByTestId("results-dashboard2")).toBeInTheDocument();
    });

    // Verify auto-save was called (the 4th fetch call)
    const calls = (global.fetch as jest.Mock).mock.calls;
    const autosaveCall = calls.find(([url]: [string]) => url === "/api/analyses");
    expect(autosaveCall).toBeTruthy();
    const [, options] = autosaveCall;
    expect(options.method).toBe("POST");
  });

  it("shows UsageDisplay when AUTH_ENABLED=true and user is logged in", () => {
    render(<AnalyzePage />);
    expect(screen.getByTestId("usage-display")).toBeInTheDocument();
  });
});
