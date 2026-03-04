import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import ResultsDashboard from "./ResultsDashboard";
import type { AnalysisResult, CalculatedMetrics } from "@/lib/calculator";

// Mock recharts -- jsdom cannot render SVG
jest.mock("recharts", () => {
  const OriginalModule = jest.requireActual("recharts");
  return {
    ...OriginalModule,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container">{children}</div>
    ),
    BarChart: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="bar-chart">{children}</div>
    ),
    LineChart: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="line-chart">{children}</div>
    ),
    PieChart: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="pie-chart">{children}</div>
    ),
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
  };
});

const sampleAnalysis: AnalysisResult = {
  property: {
    address: "Musterstr. 12, 10115 Berlin",
    sqm: 75,
    units: 12,
    yearBuilt: 1985,
    type: "ETW",
  },
  financials: {
    purchasePrice: 250000,
    hausgeld: 350,
    ruecklage: 50,
    currentRent: 800,
    expectedRent: 900,
    grunderwerbsteuer: 15000,
    notarFees: 5000,
    maklerFees: 8000,
  },
  protocols: {
    upcomingRenovations: ["Roof repair 2027"],
    sonderumlagen: ["Special levy for elevator"],
    maintenanceBacklog: ["Facade paint peeling"],
    disputes: ["Noise complaint from unit 3"],
  },
  wirtschaftsplan: {
    annualBudget: 42000,
    reserveFundStatus: "adequate",
    plannedMajorWorks: ["Heating system overhaul"],
  },
  redFlags: ["Low reserve fund", "Upcoming major renovation"],
  summary: "Decent investment opportunity.",
};

const sampleMetrics: CalculatedMetrics = {
  grossRentalYield: 4.32,
  netRentalYield: 2.37,
  totalAcquisitionCost: 278000,
  monthlyMortgagePayment: 926.13,
  monthlyCashFlow: -376.13,
  pricePerSqm: 3333.33,
  renovationReserveAdequacy: {
    adequate: true,
    message: "Monthly reserve of 50 EUR.",
  },
  breakEvenYears: null,
  assumptions: { mortgageRate: 0.035, downPayment: 0.2, loanTermYears: 25 },
};

const sampleSummary =
  "This is a solid investment.\n\nHowever, the reserve fund is low.";

const samplePriceComparison = {
  city: "Berlin",
  areaAvgPerSqm: 4500,
  areaMinPerSqm: 3000,
  areaMaxPerSqm: 6000,
};

describe("ResultsDashboard", () => {
  it("renders the Investment Report heading", () => {
    render(
      <ResultsDashboard
        analysis={sampleAnalysis}
        metrics={sampleMetrics}
        investmentSummary={sampleSummary}
        priceComparison={samplePriceComparison}
      />,
    );
    expect(
      screen.getByRole("heading", { name: /Investment Report/i }),
    ).toBeInTheDocument();
  });

  it("renders all metrics card labels", () => {
    render(
      <ResultsDashboard
        analysis={sampleAnalysis}
        metrics={sampleMetrics}
        investmentSummary={sampleSummary}
        priceComparison={samplePriceComparison}
      />,
    );
    expect(screen.getByText("Gross Yield")).toBeInTheDocument();
    expect(screen.getByText("Net Yield")).toBeInTheDocument();
    expect(screen.getByText(/Price \/ m/)).toBeInTheDocument();
    expect(screen.getByText("Monthly Cash Flow")).toBeInTheDocument();
    expect(screen.getByText("Total Acquisition Cost")).toBeInTheDocument();
  });

  it("renders formatted metric values", () => {
    render(
      <ResultsDashboard
        analysis={sampleAnalysis}
        metrics={sampleMetrics}
        investmentSummary={sampleSummary}
        priceComparison={samplePriceComparison}
      />,
    );
    // Gross yield = 4.32%
    expect(screen.getByText("4.32%")).toBeInTheDocument();
    // Net yield = 2.37%
    expect(screen.getByText("2.37%")).toBeInTheDocument();
  });

  it("renders red flags when present", () => {
    render(
      <ResultsDashboard
        analysis={sampleAnalysis}
        metrics={sampleMetrics}
        investmentSummary={sampleSummary}
        priceComparison={samplePriceComparison}
      />,
    );
    expect(screen.getByText("Red Flags")).toBeInTheDocument();
    expect(screen.getByText("Low reserve fund")).toBeInTheDocument();
    expect(
      screen.getByText("Upcoming major renovation"),
    ).toBeInTheDocument();
  });

  it("does not render red flags section when there are none", () => {
    const noRedFlagsAnalysis = { ...sampleAnalysis, redFlags: [] };
    render(
      <ResultsDashboard
        analysis={noRedFlagsAnalysis}
        metrics={sampleMetrics}
        investmentSummary={sampleSummary}
        priceComparison={samplePriceComparison}
      />,
    );
    expect(screen.queryByText("Red Flags")).not.toBeInTheDocument();
  });

  it("renders the Investment Summary section with paragraph text", () => {
    render(
      <ResultsDashboard
        analysis={sampleAnalysis}
        metrics={sampleMetrics}
        investmentSummary={sampleSummary}
        priceComparison={samplePriceComparison}
      />,
    );
    expect(
      screen.getByRole("heading", { name: /Investment Summary/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("This is a solid investment."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("However, the reserve fund is low."),
    ).toBeInTheDocument();
  });

  it("renders section headings for charts and findings", () => {
    render(
      <ResultsDashboard
        analysis={sampleAnalysis}
        metrics={sampleMetrics}
        investmentSummary={sampleSummary}
        priceComparison={samplePriceComparison}
      />,
    );
    expect(screen.getByText("Acquisition Cost Breakdown")).toBeInTheDocument();
    expect(screen.getByText("Protocol Findings")).toBeInTheDocument();
  });

  it("renders protocol findings categories when present", () => {
    render(
      <ResultsDashboard
        analysis={sampleAnalysis}
        metrics={sampleMetrics}
        investmentSummary={sampleSummary}
        priceComparison={samplePriceComparison}
      />,
    );
    expect(screen.getByText("Upcoming Renovations")).toBeInTheDocument();
    expect(screen.getByText("Sonderumlagen")).toBeInTheDocument();
    expect(screen.getByText("Maintenance Backlog")).toBeInTheDocument();
    expect(screen.getByText("Disputes")).toBeInTheDocument();
    expect(screen.getAllByText("Roof repair 2027").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Special levy for elevator")).toBeInTheDocument();
    expect(screen.getAllByText("Facade paint peeling").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Noise complaint from unit 3")).toBeInTheDocument();
  });

  it("does not render Protocol Findings section when all protocol arrays are empty", () => {
    const noProtocolAnalysis = {
      ...sampleAnalysis,
      protocols: {
        upcomingRenovations: [],
        sonderumlagen: [],
        maintenanceBacklog: [],
        disputes: [],
      },
    };
    render(
      <ResultsDashboard
        analysis={noProtocolAnalysis}
        metrics={sampleMetrics}
        investmentSummary={sampleSummary}
        priceComparison={samplePriceComparison}
      />,
    );
    expect(screen.queryByText("Protocol Findings")).not.toBeInTheDocument();
  });

  it("shows area comparison unavailable when priceComparison is null", () => {
    render(
      <ResultsDashboard
        analysis={sampleAnalysis}
        metrics={sampleMetrics}
        investmentSummary={sampleSummary}
        priceComparison={null}
      />,
    );
    expect(
      screen.getByText("Area comparison unavailable"),
    ).toBeInTheDocument();
  });

  it("renders the city name when priceComparison is provided", () => {
    render(
      <ResultsDashboard
        analysis={sampleAnalysis}
        metrics={sampleMetrics}
        investmentSummary={sampleSummary}
        priceComparison={samplePriceComparison}
      />,
    );
    expect(screen.getByText(/Berlin \(estimated\)/)).toBeInTheDocument();
  });

  it("renders Print Report and disabled Download PDF buttons", () => {
    render(
      <ResultsDashboard
        analysis={sampleAnalysis}
        metrics={sampleMetrics}
        investmentSummary={sampleSummary}
        priceComparison={samplePriceComparison}
      />,
    );
    expect(
      screen.getByRole("button", { name: /Print Report/i }),
    ).toBeInTheDocument();
    const pdfButton = screen.getByRole("button", { name: /Download PDF/i });
    expect(pdfButton).toBeDisabled();
  });

  it("renders Upcoming Renovations & Risks section when upcomingRenovations exist", () => {
    render(
      <ResultsDashboard
        analysis={sampleAnalysis}
        metrics={sampleMetrics}
        investmentSummary={sampleSummary}
        priceComparison={samplePriceComparison}
      />,
    );
    expect(screen.getByText(/Upcoming Renovations & Risks/i)).toBeInTheDocument();
    expect(screen.getAllByText("Renovation").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Backlog").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Planned").length).toBeGreaterThanOrEqual(1);
  });

  // New tests for coverage gaps

  it("shows text-red-600 for low gross yield (< 3)", () => {
    const lowYieldMetrics = {
      ...sampleMetrics,
      grossRentalYield: 1,
      netRentalYield: 0.5,
    };
    const { container } = render(
      <ResultsDashboard
        analysis={sampleAnalysis}
        metrics={lowYieldMetrics}
        investmentSummary={sampleSummary}
        priceComparison={samplePriceComparison}
      />,
    );
    // Find the gross yield value element
    const yieldValue = screen.getByText("1.00%");
    expect(yieldValue.className).toContain("text-red-600");
  });

  it("shows text-yellow-600 for medium gross yield (3-5)", () => {
    const medYieldMetrics = {
      ...sampleMetrics,
      grossRentalYield: 4,
    };
    render(
      <ResultsDashboard
        analysis={sampleAnalysis}
        metrics={medYieldMetrics}
        investmentSummary={sampleSummary}
        priceComparison={samplePriceComparison}
      />,
    );
    const yieldValue = screen.getByText("4.00%");
    expect(yieldValue.className).toContain("text-yellow-600");
  });

  it("shows em-dash for null metrics values", () => {
    const nullMetrics: CalculatedMetrics = {
      ...sampleMetrics,
      grossRentalYield: null,
      netRentalYield: null,
      monthlyCashFlow: null,
      pricePerSqm: null,
    };
    render(
      <ResultsDashboard
        analysis={sampleAnalysis}
        metrics={nullMetrics}
        investmentSummary={sampleSummary}
        priceComparison={samplePriceComparison}
      />,
    );
    // The em-dash character \u2014 should appear for null values
    const emDashes = screen.getAllByText("\u2014");
    expect(emDashes.length).toBeGreaterThanOrEqual(3);
  });

  it("shows text-green-600 for positive cash flow", () => {
    const positiveCFMetrics = {
      ...sampleMetrics,
      monthlyCashFlow: 500,
    };
    render(
      <ResultsDashboard
        analysis={sampleAnalysis}
        metrics={positiveCFMetrics}
        investmentSummary={sampleSummary}
        priceComparison={samplePriceComparison}
      />,
    );
    // Monthly cash flow card should have green text
    const cfCard = screen.getByText("Monthly Cash Flow").closest("div");
    const valueEl = cfCard!.querySelector(".text-green-600");
    expect(valueEl).toBeTruthy();
  });

  it("calls window.print() when Print Report button is clicked", () => {
    const printSpy = jest.spyOn(window, "print").mockImplementation(() => {});
    render(
      <ResultsDashboard
        analysis={sampleAnalysis}
        metrics={sampleMetrics}
        investmentSummary={sampleSummary}
        priceComparison={samplePriceComparison}
      />,
    );
    const printButton = screen.getByRole("button", { name: /Print Report/i });
    fireEvent.click(printButton);
    expect(printSpy).toHaveBeenCalled();
    printSpy.mockRestore();
  });

  it("shows 'Cost data not available' when purchasePrice is null", () => {
    const noCostAnalysis = {
      ...sampleAnalysis,
      financials: {
        ...sampleAnalysis.financials,
        purchasePrice: null,
        grunderwerbsteuer: null,
        notarFees: null,
        maklerFees: null,
      },
    };
    render(
      <ResultsDashboard
        analysis={noCostAnalysis}
        metrics={sampleMetrics}
        investmentSummary={sampleSummary}
        priceComparison={samplePriceComparison}
      />,
    );
    expect(screen.getByText("Cost data not available")).toBeInTheDocument();
  });

  it("renders cash flow chart when monthlyCashFlow is not null", () => {
    const positiveMetrics = {
      ...sampleMetrics,
      monthlyCashFlow: 500,
      assumptions: { ...sampleMetrics.assumptions, loanTermYears: 20 },
    };
    render(
      <ResultsDashboard
        analysis={sampleAnalysis}
        metrics={positiveMetrics}
        investmentSummary={sampleSummary}
        priceComparison={samplePriceComparison}
      />,
    );
    expect(
      screen.getByText(/Monthly Cash Flow Projection/),
    ).toBeInTheDocument();
    expect(screen.getByTestId("line-chart")).toBeInTheDocument();
  });

  it("shows mortgage end note when loanTermYears < 25", () => {
    const shortLoanMetrics = {
      ...sampleMetrics,
      monthlyCashFlow: 500,
      assumptions: { ...sampleMetrics.assumptions, loanTermYears: 20 },
    };
    render(
      <ResultsDashboard
        analysis={sampleAnalysis}
        metrics={shortLoanMetrics}
        investmentSummary={sampleSummary}
        priceComparison={samplePriceComparison}
      />,
    );
    expect(screen.getByText(/Mortgage ends in year 20/)).toBeInTheDocument();
  });

  it("does not show cash flow chart when monthlyCashFlow is null", () => {
    const nullCFMetrics = {
      ...sampleMetrics,
      monthlyCashFlow: null,
    };
    render(
      <ResultsDashboard
        analysis={sampleAnalysis}
        metrics={nullCFMetrics}
        investmentSummary={sampleSummary}
        priceComparison={samplePriceComparison}
      />,
    );
    expect(screen.queryByText(/Monthly Cash Flow Projection/)).not.toBeInTheDocument();
  });
});
