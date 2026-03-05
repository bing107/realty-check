import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import ResultsPage from "./page";

const mockUseSession = jest.fn();
const mockPush = jest.fn();

jest.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/analyze/results/test-id",
  useParams: () => ({ id: "test-id" }),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock recharts
jest.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PieChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => null,
  Line: () => null,
  Pie: () => null,
  Cell: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ReferenceLine: () => null,
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

const validAnalysis = {
  property: { address: "Test St 1", sqm: 75, units: 12, yearBuilt: 1985, type: "ETW" },
  financials: {
    purchasePrice: 250000, hausgeld: 350, ruecklage: 50,
    currentRent: 800, expectedRent: 900,
    grunderwerbsteuer: 15000, notarFees: 5000, maklerFees: 8000,
  },
  protocols: { upcomingRenovations: [], sonderumlagen: [], maintenanceBacklog: [], disputes: [] },
  wirtschaftsplan: { annualBudget: 42000, reserveFundStatus: "adequate", plannedMajorWorks: [] },
  redFlags: [],
  summary: "Good property.",
};

const validMetrics = {
  grossRentalYield: 4.32, netRentalYield: 2.37,
  totalAcquisitionCost: 278000, monthlyMortgagePayment: 926,
  monthlyCashFlow: -376, pricePerSqm: 3333,
  renovationReserveAdequacy: { adequate: true, message: "OK" },
  breakEvenYears: null,
  assumptions: { mortgageRate: 0.035, downPayment: 0.2, loanTermYears: 25 },
};

const validSummary = {
  investmentSummary: "Good investment.",
  priceComparison: { city: "Berlin", areaAvgPerSqm: 4500, areaMinPerSqm: 3000, areaMaxPerSqm: 6000 },
};

describe("ResultsPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSession.mockReturnValue({ data: { user: { id: "1" } }, status: "authenticated" });
  });

  it("shows Loading... initially", () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(<ResultsPage />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows error message when API returns error", async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ error: "Not found" }),
    });

    render(<ResultsPage />);

    await waitFor(() => {
      expect(screen.getByText("Not found")).toBeInTheDocument();
    });
  });

  it("shows Analysis not found when saved is null", async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ analysis: null }),
    });

    render(<ResultsPage />);

    await waitFor(() => {
      expect(screen.getByText("Analysis not found")).toBeInTheDocument();
    });
  });

  it("shows Failed to load analysis on fetch error", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    render(<ResultsPage />);

    await waitFor(() => {
      expect(screen.getByText("Failed to load analysis")).toBeInTheDocument();
    });
  });

  it("shows Failed to parse analysis data when JSON is invalid", async () => {
    mockFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          analysis: {
            id: "1",
            filename: "test.pdf",
            createdAt: "2026-01-15T00:00:00Z",
            analysisJson: "not-valid-json",
            metrics: null,
            summary: null,
          },
        }),
    });

    render(<ResultsPage />);

    await waitFor(() => {
      expect(screen.getByText("Failed to parse analysis data")).toBeInTheDocument();
    });
  });

  it("shows Incomplete analysis data when metrics are missing", async () => {
    mockFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          analysis: {
            id: "1",
            filename: "test.pdf",
            createdAt: "2026-01-15T00:00:00Z",
            analysisJson: JSON.stringify(validAnalysis),
            metrics: null,
            summary: null,
          },
        }),
    });

    render(<ResultsPage />);

    await waitFor(() => {
      expect(screen.getByText("Incomplete analysis data")).toBeInTheDocument();
    });
  });

  it("renders ResultsDashboard when data is complete", async () => {
    mockFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          analysis: {
            id: "1",
            filename: "test.pdf",
            createdAt: "2026-01-15T00:00:00Z",
            analysisJson: JSON.stringify(validAnalysis),
            metrics: JSON.stringify(validMetrics),
            summary: JSON.stringify(validSummary),
          },
        }),
    });

    render(<ResultsPage />);

    await waitFor(() => {
      expect(screen.getByText("test.pdf")).toBeInTheDocument();
      expect(screen.getByText("Investment Report")).toBeInTheDocument();
    });
  });

  it("shows Incomplete analysis data when summary has no investmentSummary or priceComparison (lines 77-78)", async () => {
    mockFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          analysis: {
            id: "1",
            filename: "test.pdf",
            createdAt: "2026-01-15T00:00:00Z",
            analysisJson: JSON.stringify(validAnalysis),
            metrics: JSON.stringify(validMetrics),
            summary: JSON.stringify({}),
          },
        }),
    });

    render(<ResultsPage />);

    await waitFor(() => {
      // investmentSummary = null from {} || null, so shows incomplete
      expect(screen.getByText("Incomplete analysis data")).toBeInTheDocument();
    });
  });

  it("shows 'Analysis' fallback when filename is null (line 102)", async () => {
    mockFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          analysis: {
            id: "1",
            filename: null,
            createdAt: "2026-01-15T00:00:00Z",
            analysisJson: JSON.stringify(validAnalysis),
            metrics: JSON.stringify(validMetrics),
            summary: JSON.stringify(validSummary),
          },
        }),
    });

    render(<ResultsPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Analysis" })).toBeInTheDocument();
      expect(screen.getByText("Investment Report")).toBeInTheDocument();
    });
  });
});
