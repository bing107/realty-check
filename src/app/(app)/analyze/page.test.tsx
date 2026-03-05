import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import AnalyzePage from "./page";

// Track onFilesChange for triggering file upload
let capturedOnFilesChange: ((files: File[]) => void) = () => {};

jest.mock("next-auth/react", () => ({
  useSession: () => ({ data: null, status: "unauthenticated" }),
}));

let mockSearchParams = new URLSearchParams();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => "/analyze",
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

jest.mock("@/lib/auth-config", () => ({
  AUTH_ENABLED: false,
  STRIPE_ENABLED: false,
}));

jest.mock("@/lib/analytics", () => ({
  track: jest.fn(),
}));

jest.mock("@/lib/pdf-extract", () => ({
  extractTextFromPdf: jest.fn(),
}));

jest.mock("@/app/components/UploadZone", () => ({
  __esModule: true,
  default: ({ onFilesChange }: { onFilesChange: (f: File[]) => void }) => {
    capturedOnFilesChange = onFilesChange;
    return <div data-testid="upload-zone">UploadZone</div>;
  },
}));

jest.mock("@/app/components/ApiKeyInput", () => ({
  __esModule: true,
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <input data-testid="api-key-input" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

jest.mock("@/app/components/ResultsDashboard", () => ({
  __esModule: true,
  default: () => <div data-testid="results-dashboard">ResultsDashboard</div>,
}));

jest.mock("@/app/components/UsageDisplay", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/app/components/UpgradePrompt", () => ({
  __esModule: true,
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="upgrade-prompt">
      <button onClick={onClose}>Close upgrade</button>
    </div>
  ),
}));

jest.mock("@/app/components/WizardStepIndicator", () => ({
  __esModule: true,
  default: ({ currentStep }: { currentStep: string }) => (
    <div data-testid="wizard-step">{currentStep}</div>
  ),
}));

import { extractTextFromPdf } from "@/lib/pdf-extract";
const mockExtractTextFromPdf = extractTextFromPdf as jest.Mock;

const validAnalysis = {
  property: { address: "123 Main St", sqm: 75, units: 12, yearBuilt: 1985, type: "ETW" },
  financials: {
    purchasePrice: 250000, hausgeld: 350, ruecklage: 50,
    currentRent: 800, expectedRent: 900,
    grunderwerbsteuer: 15000, notarFees: 5000, maklerFees: 8000,
  },
  protocols: { upcomingRenovations: ["Roof 2027"], sonderumlagen: [], maintenanceBacklog: [], disputes: [] },
  wirtschaftsplan: { annualBudget: 42000, reserveFundStatus: "adequate", plannedMajorWorks: [] },
  redFlags: ["Low reserve fund"],
  summary: "Decent investment opportunity.",
};

const validMetrics = {
  grossRentalYield: 4.32, netRentalYield: 2.37,
  totalAcquisitionCost: 278000, monthlyMortgagePayment: 926.13,
  monthlyCashFlow: -376.13, pricePerSqm: 3333.33,
  renovationReserveAdequacy: { adequate: true, message: "OK" },
  breakEvenYears: null,
  assumptions: { mortgageRate: 0.035, downPayment: 0.2, loanTermYears: 25 },
};

describe("AnalyzePage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders without crashing", () => {
    render(<AnalyzePage />);
    expect(screen.getByText("Analyze Property")).toBeInTheDocument();
  });

  it("shows upload step initially", () => {
    render(<AnalyzePage />);
    expect(screen.getByTestId("wizard-step")).toHaveTextContent("upload");
  });

  it("renders the Analyze Documents button (disabled by default)", () => {
    render(<AnalyzePage />);
    const button = screen.getByRole("button", { name: "Analyze Documents" });
    expect(button).toBeDisabled();
  });

  it("renders UploadZone component", () => {
    render(<AnalyzePage />);
    expect(screen.getByTestId("upload-zone")).toBeInTheDocument();
  });

  it("renders ApiKeyInput component", () => {
    render(<AnalyzePage />);
    expect(screen.getByTestId("api-key-input")).toBeInTheDocument();
  });

  it("shows checkout success banner when checkout=success in URL", () => {
    mockSearchParams = new URLSearchParams("checkout=success");
    render(<AnalyzePage />);
    expect(screen.getByText(/Subscription activated/)).toBeInTheDocument();
  });

  it("Analyze Documents button becomes enabled when files are added", () => {
    render(<AnalyzePage />);
    const file = new File(["content"], "test.pdf", { type: "application/pdf" });
    act(() => { capturedOnFilesChange([file]); });
    const button = screen.getByRole("button", { name: "Analyze Documents" });
    expect(button).not.toBeDisabled();
  });

  it("handleAnalyze: extracts PDF text and shows extraction results", async () => {
    mockExtractTextFromPdf.mockResolvedValue({
      filename: "test.pdf",
      text: "Extracted text from PDF",
      pages: 3,
      isScanned: false,
    });

    render(<AnalyzePage />);
    const file = new File(["content"], "test.pdf", { type: "application/pdf" });
    act(() => { capturedOnFilesChange([file]); });

    const analyzeBtn = screen.getByRole("button", { name: "Analyze Documents" });
    await act(async () => { fireEvent.click(analyzeBtn); });

    expect(screen.getByText("Extraction Results")).toBeInTheDocument();
    expect(screen.getByText("test.pdf")).toBeInTheDocument();
  });

  it("handleAnalyze: shows extract errors when extractTextFromPdf throws", async () => {
    mockExtractTextFromPdf.mockRejectedValue(new Error("PDF parse failed"));

    render(<AnalyzePage />);
    const file = new File(["content"], "test.pdf", { type: "application/pdf" });
    act(() => { capturedOnFilesChange([file]); });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Analyze Documents" }));
    });

    expect(screen.getByText("Extraction Errors")).toBeInTheDocument();
    expect(screen.getByText("PDF parse failed")).toBeInTheDocument();
  });

  it("handleAnalyze: shows extract error with generic message when non-Error thrown", async () => {
    mockExtractTextFromPdf.mockRejectedValue("string error");

    render(<AnalyzePage />);
    const file = new File(["content"], "test.pdf", { type: "application/pdf" });
    act(() => { capturedOnFilesChange([file]); });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Analyze Documents" }));
    });

    expect(screen.getByText("Failed to extract")).toBeInTheDocument();
  });

  it("handleAnalyze: shows fetch error when outer try block throws unexpectedly (covers outer catch)", async () => {
    const mockTrack = jest.requireMock("@/lib/analytics").track as jest.Mock;
    // track is called 3 times before/during extraction:
    // 1. files_uploaded (line 62, on file select)
    // 2. extraction_started (line 85, before outer try)
    // 3. extraction_completed (line 150, inside outer try) — this one throws
    mockTrack
      .mockImplementationOnce(() => undefined)  // files_uploaded
      .mockImplementationOnce(() => undefined)  // extraction_started
      .mockImplementationOnce(() => { throw new Error("track failure"); });  // extraction_completed

    mockExtractTextFromPdf.mockResolvedValue({
      filename: "test.pdf",
      text: "content",
      pages: 1,
      isScanned: false,
    });

    render(<AnalyzePage />);
    const file = new File(["content"], "test.pdf", { type: "application/pdf" });
    act(() => { capturedOnFilesChange([file]); });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Analyze Documents" }));
    });

    expect(screen.getByText("Failed to extract documents. Please try again.")).toBeInTheDocument();
  });

  it("handleAiAnalysis: calls /api/analyze and shows results", async () => {
    mockExtractTextFromPdf.mockResolvedValue({
      filename: "test.pdf",
      text: "Extracted text",
      pages: 2,
      isScanned: false,
    });

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ analysis: validAnalysis }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ metrics: validMetrics }),
      });

    render(<AnalyzePage />);
    const file = new File(["content"], "test.pdf", { type: "application/pdf" });
    act(() => { capturedOnFilesChange([file]); });

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
      expect(screen.getByText("AI Analysis Results")).toBeInTheDocument();
    });

    expect(screen.getByText("Decent investment opportunity.")).toBeInTheDocument();
  });

  it("handleAiAnalysis: shows upgrade prompt on 403 limit_reached", async () => {
    mockExtractTextFromPdf.mockResolvedValue({
      filename: "test.pdf",
      text: "Extracted text",
      pages: 1,
      isScanned: false,
    });

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: "limit_reached", tier: "free" }),
    });

    render(<AnalyzePage />);
    const file = new File(["content"], "test.pdf", { type: "application/pdf" });
    act(() => { capturedOnFilesChange([file]); });

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
      expect(screen.getByTestId("upgrade-prompt")).toBeInTheDocument();
    });
  });

  it("handleAiAnalysis: shows error on non-403 failure", async () => {
    mockExtractTextFromPdf.mockResolvedValue({
      filename: "test.pdf",
      text: "Extracted text",
      pages: 1,
      isScanned: false,
    });

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: "Internal server error" }),
    });

    render(<AnalyzePage />);
    const file = new File(["content"], "test.pdf", { type: "application/pdf" });
    act(() => { capturedOnFilesChange([file]); });

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
      expect(screen.getByText("Internal server error")).toBeInTheDocument();
    });
  });

  it("handleAiAnalysis: shows generic error on network exception", async () => {
    mockExtractTextFromPdf.mockResolvedValue({
      filename: "test.pdf",
      text: "Extracted text",
      pages: 1,
      isScanned: false,
    });

    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("Network failed"));

    render(<AnalyzePage />);
    const file = new File(["content"], "test.pdf", { type: "application/pdf" });
    act(() => { capturedOnFilesChange([file]); });

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
      expect(screen.getByText("Failed to analyze documents. Please try again.")).toBeInTheDocument();
    });
  });

  it("handleAiAnalysis: shows metricsError when /api/calculate fails", async () => {
    mockExtractTextFromPdf.mockResolvedValue({
      filename: "test.pdf",
      text: "Extracted text",
      pages: 1,
      isScanned: false,
    });

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ analysis: validAnalysis }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: "Calculation failed" }),
      });

    render(<AnalyzePage />);
    const file = new File(["content"], "test.pdf", { type: "application/pdf" });
    act(() => { capturedOnFilesChange([file]); });

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
      expect(screen.getByText(/Financial metrics calculation failed/)).toBeInTheDocument();
    });
  });

  it("handleAiAnalysis: shows metricsError when /api/calculate throws", async () => {
    mockExtractTextFromPdf.mockResolvedValue({
      filename: "test.pdf",
      text: "Extracted text",
      pages: 1,
      isScanned: false,
    });

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ analysis: validAnalysis }),
      })
      .mockRejectedValueOnce(new Error("Network error"));

    render(<AnalyzePage />);
    const file = new File(["content"], "test.pdf", { type: "application/pdf" });
    act(() => { capturedOnFilesChange([file]); });

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
      expect(screen.getByText(/Financial metrics calculation failed/)).toBeInTheDocument();
    });
  });

  it("handleGenerateReport: shows dashboard when all data is ready", async () => {
    mockExtractTextFromPdf.mockResolvedValue({
      filename: "test.pdf",
      text: "Extracted text",
      pages: 1,
      isScanned: false,
    });

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
        json: async () => ({ investmentSummary: "Great property!", priceComparison: null }),
      });

    render(<AnalyzePage />);
    const file = new File(["content"], "test.pdf", { type: "application/pdf" });
    act(() => { capturedOnFilesChange([file]); });

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
      expect(screen.getByTestId("results-dashboard")).toBeInTheDocument();
    });
  });

  it("handleGenerateReport: shows error when /api/summary fails", async () => {
    mockExtractTextFromPdf.mockResolvedValue({
      filename: "test.pdf",
      text: "Extracted text",
      pages: 1,
      isScanned: false,
    });

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
        ok: false,
        status: 500,
        json: async () => ({ error: "Summary generation failed" }),
      });

    render(<AnalyzePage />);
    const file = new File(["content"], "test.pdf", { type: "application/pdf" });
    act(() => { capturedOnFilesChange([file]); });

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
      expect(screen.getByText("Summary generation failed")).toBeInTheDocument();
    });
  });

  it("handleGenerateReport: shows generic error on network exception", async () => {
    mockExtractTextFromPdf.mockResolvedValue({
      filename: "test.pdf",
      text: "Extracted text",
      pages: 1,
      isScanned: false,
    });

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ analysis: validAnalysis }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ metrics: validMetrics }),
      })
      .mockRejectedValueOnce(new Error("Network error"));

    render(<AnalyzePage />);
    const file = new File(["content"], "test.pdf", { type: "application/pdf" });
    act(() => { capturedOnFilesChange([file]); });

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
      expect(screen.getByText("Failed to generate report. Please try again.")).toBeInTheDocument();
    });
  });

  it("renders subtitle text", () => {
    render(<AnalyzePage />);
    expect(screen.getByText("Upload broker documents for AI-powered investment analysis")).toBeInTheDocument();
  });

  // OCR batch handling tests (lines 107-147)
  it("handleAnalyze: performs OCR on scanned PDFs and merges text", async () => {
    mockExtractTextFromPdf.mockResolvedValue({
      filename: "scanned.pdf",
      text: "",
      pages: 2,
      isScanned: true,
      imageBatches: [["data:image/jpeg;base64,AAA"]],
    });

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: "OCR extracted text" }),
    });

    render(<AnalyzePage />);
    const file = new File(["content"], "scanned.pdf", { type: "application/pdf" });
    act(() => { capturedOnFilesChange([file]); });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Analyze Documents" }));
    });

    await waitFor(() => {
      expect(screen.getByText("Extraction Results")).toBeInTheDocument();
    });
    // OCR badge should appear
    expect(screen.getByText("OCR")).toBeInTheDocument();
  });

  it("handleAnalyze: shows OCR error when batch fails", async () => {
    mockExtractTextFromPdf.mockResolvedValue({
      filename: "scanned.pdf",
      text: "",
      pages: 1,
      isScanned: true,
      imageBatches: [["data:image/jpeg;base64,AAA"]],
    });

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Invalid image" }),
    });

    render(<AnalyzePage />);
    const file = new File(["content"], "scanned.pdf", { type: "application/pdf" });
    act(() => { capturedOnFilesChange([file]); });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Analyze Documents" }));
    });

    await waitFor(() => {
      expect(screen.getByText("Extraction Errors")).toBeInTheDocument();
      expect(screen.getByText(/OCR failed: Invalid image/)).toBeInTheDocument();
    });
  });

  it("handleAnalyze: shows OCR network error on fetch exception", async () => {
    mockExtractTextFromPdf.mockResolvedValue({
      filename: "scanned.pdf",
      text: "",
      pages: 1,
      isScanned: true,
      imageBatches: [["data:image/jpeg;base64,AAA"]],
    });

    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("Network down"));

    render(<AnalyzePage />);
    const file = new File(["content"], "scanned.pdf", { type: "application/pdf" });
    act(() => { capturedOnFilesChange([file]); });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Analyze Documents" }));
    });

    await waitFor(() => {
      expect(screen.getByText("Extraction Errors")).toBeInTheDocument();
      expect(screen.getByText(/OCR failed: network error/)).toBeInTheDocument();
    });
  });

  // Rendering tests for the raw analysis sections (lines 393-568)
  it("renders Property, Financials, Wirtschaftsplan sections after AI analysis", async () => {
    mockExtractTextFromPdf.mockResolvedValue({
      filename: "test.pdf",
      text: "Extracted text",
      pages: 1,
      isScanned: false,
    });

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ analysis: validAnalysis }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ metrics: validMetrics }),
      });

    render(<AnalyzePage />);
    const file = new File(["content"], "test.pdf", { type: "application/pdf" });
    act(() => { capturedOnFilesChange([file]); });

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
      // Property section
      expect(screen.getByText("Property")).toBeInTheDocument();
      expect(screen.getByText("123 Main St")).toBeInTheDocument();

      // Financials section
      expect(screen.getByText("Financials")).toBeInTheDocument();
      expect(screen.getByText("Purchase Price")).toBeInTheDocument();

      // Protocol Findings section (has upcomingRenovations)
      expect(screen.getByText("Protocol Findings")).toBeInTheDocument();
      expect(screen.getByText("Upcoming Renovations")).toBeInTheDocument();
      expect(screen.getByText("Roof 2027")).toBeInTheDocument();

      // Wirtschaftsplan section
      expect(screen.getByText("Wirtschaftsplan")).toBeInTheDocument();
      expect(screen.getByText("Annual Budget")).toBeInTheDocument();
      expect(screen.getByText("Reserve Fund Status")).toBeInTheDocument();

      // Red flags
      expect(screen.getByText("Red Flags")).toBeInTheDocument();
      expect(screen.getByText("Low reserve fund")).toBeInTheDocument();
    });
  });

  it("renders all protocol subsections when analysis has all protocol data", async () => {
    const fullAnalysis = {
      ...validAnalysis,
      protocols: {
        upcomingRenovations: ["Roof 2027"],
        sonderumlagen: ["Special levy 5000 EUR"],
        maintenanceBacklog: ["Facade needs paint"],
        disputes: ["Noise complaint unit 3"],
      },
      wirtschaftsplan: {
        annualBudget: 42000,
        reserveFundStatus: "adequate",
        plannedMajorWorks: ["Heating system overhaul"],
      },
    };

    mockExtractTextFromPdf.mockResolvedValue({
      filename: "test.pdf",
      text: "Extracted text",
      pages: 1,
      isScanned: false,
    });

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ analysis: fullAnalysis }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ metrics: validMetrics }),
      });

    render(<AnalyzePage />);
    const file = new File(["content"], "test.pdf", { type: "application/pdf" });
    act(() => { capturedOnFilesChange([file]); });

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
      // All protocol sub-sections
      expect(screen.getByText("Sonderumlagen")).toBeInTheDocument();
      expect(screen.getByText("Special levy 5000 EUR")).toBeInTheDocument();
      expect(screen.getByText("Maintenance Backlog")).toBeInTheDocument();
      expect(screen.getByText("Facade needs paint")).toBeInTheDocument();
      expect(screen.getByText("Disputes")).toBeInTheDocument();
      expect(screen.getByText("Noise complaint unit 3")).toBeInTheDocument();
      // Wirtschaftsplan with planned works
      expect(screen.getByText("Planned Major Works")).toBeInTheDocument();
      expect(screen.getByText("Heating system overhaul")).toBeInTheDocument();
    });
  });

  it("closing upgrade prompt hides it", async () => {
    mockExtractTextFromPdf.mockResolvedValue({
      filename: "test.pdf",
      text: "Extracted text",
      pages: 1,
      isScanned: false,
    });

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: "limit_reached", tier: "free" }),
    });

    render(<AnalyzePage />);
    const file = new File(["content"], "test.pdf", { type: "application/pdf" });
    act(() => { capturedOnFilesChange([file]); });

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
      expect(screen.getByTestId("upgrade-prompt")).toBeInTheDocument();
    });

    // Close the upgrade prompt
    fireEvent.click(screen.getByText("Close upgrade"));

    await waitFor(() => {
      expect(screen.queryByTestId("upgrade-prompt")).not.toBeInTheDocument();
    });
  });

  it("shows formatEur em-dash for null values in financial table", async () => {
    const analysisWithNulls = {
      ...validAnalysis,
      financials: {
        purchasePrice: null,
        hausgeld: null,
        ruecklage: null,
        currentRent: null,
        expectedRent: null,
        grunderwerbsteuer: null,
        notarFees: null,
        maklerFees: null,
      },
    };

    mockExtractTextFromPdf.mockResolvedValue({
      filename: "test.pdf",
      text: "Extracted text",
      pages: 1,
      isScanned: false,
    });

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ analysis: analysisWithNulls }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ metrics: validMetrics }),
      });

    render(<AnalyzePage />);
    const file = new File(["content"], "test.pdf", { type: "application/pdf" });
    act(() => { capturedOnFilesChange([file]); });

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
      // Em-dashes should appear for null financial values
      const emDashes = screen.getAllByText("\u2014");
      expect(emDashes.length).toBeGreaterThanOrEqual(8);
    });
  });
});
