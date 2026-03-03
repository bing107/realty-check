"use client";

import type { AnalysisResult, CalculatedMetrics } from "@/lib/calculator";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface PriceComparison {
  city: string;
  areaAvgPerSqm: number;
  areaMinPerSqm: number;
  areaMaxPerSqm: number;
}

interface ResultsDashboardProps {
  analysis: AnalysisResult;
  metrics: CalculatedMetrics;
  investmentSummary: string;
  priceComparison: PriceComparison | null;
}

function formatEur(value: number | null): string {
  if (value === null || value === undefined) return "\u2014";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPct(value: number | null): string {
  if (value === null || value === undefined) return "\u2014";
  return value.toFixed(2) + "%";
}

function yieldColor(
  value: number | null,
  greenThreshold: number,
  yellowThreshold: number,
): string {
  if (value === null) return "text-gray-500";
  if (value >= greenThreshold) return "text-green-600";
  if (value >= yellowThreshold) return "text-yellow-600";
  return "text-red-600";
}

function yieldBg(
  value: number | null,
  greenThreshold: number,
  yellowThreshold: number,
): string {
  if (value === null) return "bg-gray-50";
  if (value >= greenThreshold) return "bg-green-50";
  if (value >= yellowThreshold) return "bg-yellow-50";
  return "bg-red-50";
}

// ---- Component ----

export default function ResultsDashboard({
  analysis,
  metrics,
  investmentSummary,
  priceComparison,
}: ResultsDashboardProps) {
  // ----- A: Metrics Cards -----
  const metricsCards = [
    {
      label: "Gross Yield",
      value: formatPct(metrics.grossRentalYield),
      color: yieldColor(metrics.grossRentalYield, 5, 3),
      bg: yieldBg(metrics.grossRentalYield, 5, 3),
    },
    {
      label: "Net Yield",
      value: formatPct(metrics.netRentalYield),
      color: yieldColor(metrics.netRentalYield, 4, 2),
      bg: yieldBg(metrics.netRentalYield, 4, 2),
    },
    {
      label: "Price / m\u00B2",
      value: metrics.pricePerSqm !== null ? formatEur(metrics.pricePerSqm) : "\u2014",
      color: "text-gray-900",
      bg: "bg-white",
    },
    {
      label: "Monthly Cash Flow",
      value: formatEur(metrics.monthlyCashFlow),
      color:
        metrics.monthlyCashFlow !== null && metrics.monthlyCashFlow > 0
          ? "text-green-600"
          : metrics.monthlyCashFlow !== null && metrics.monthlyCashFlow < 0
            ? "text-red-600"
            : "text-gray-500",
      bg:
        metrics.monthlyCashFlow !== null && metrics.monthlyCashFlow > 0
          ? "bg-green-50"
          : metrics.monthlyCashFlow !== null && metrics.monthlyCashFlow < 0
            ? "bg-red-50"
            : "bg-white",
    },
    {
      label: "Total Acquisition Cost",
      value: formatEur(metrics.totalAcquisitionCost),
      color: "text-gray-900",
      bg: "bg-white",
    },
  ];

  // ----- B: Price Comparison Bar Chart -----
  const priceBarData = priceComparison
    ? [
        {
          name: "This Property",
          value: metrics.pricePerSqm ?? 0,
          base: 0,
        },
        {
          name: "Area Average",
          value: priceComparison.areaAvgPerSqm,
          base: 0,
        },
        {
          name: "Area Range",
          value: priceComparison.areaMaxPerSqm - priceComparison.areaMinPerSqm,
          base: priceComparison.areaMinPerSqm,
        },
      ]
    : null;

  // ----- C: Cash Flow Projection Line Chart -----
  const cashFlowData: { year: number; cashFlow: number }[] = [];
  if (metrics.monthlyCashFlow !== null) {
    const loanTerm = metrics.assumptions.loanTermYears;
    const monthlyRent =
      analysis.financials.expectedRent ?? analysis.financials.currentRent ?? 0;
    const hausgeld = analysis.financials.hausgeld ?? 0;

    for (let yr = 1; yr <= 25; yr++) {
      if (yr <= loanTerm) {
        cashFlowData.push({ year: yr, cashFlow: Math.round(metrics.monthlyCashFlow) });
      } else {
        // After loan paid off: rent - hausgeld, no mortgage
        cashFlowData.push({
          year: yr,
          cashFlow: Math.round(monthlyRent - hausgeld),
        });
      }
    }
  }

  // ----- D: Cost Breakdown Pie Chart -----
  const PIE_COLORS = ["#3B82F6", "#F97316", "#22C55E", "#A855F7"];
  const costSlices: { name: string; value: number }[] = [];
  if (analysis.financials.purchasePrice !== null) {
    costSlices.push({ name: "Purchase Price", value: analysis.financials.purchasePrice });
  }
  if (analysis.financials.grunderwerbsteuer !== null) {
    costSlices.push({
      name: "Grunderwerbsteuer",
      value: analysis.financials.grunderwerbsteuer,
    });
  }
  if (analysis.financials.notarFees !== null) {
    costSlices.push({ name: "Notar Fees", value: analysis.financials.notarFees });
  }
  if (analysis.financials.maklerFees !== null) {
    costSlices.push({ name: "Makler Fees", value: analysis.financials.maklerFees });
  }

  // ----- Protocol helpers -----
  const hasProtocolFindings =
    analysis.protocols.upcomingRenovations.length > 0 ||
    analysis.protocols.sonderumlagen.length > 0 ||
    analysis.protocols.maintenanceBacklog.length > 0 ||
    analysis.protocols.disputes.length > 0;

  return (
    <div className="mt-8 space-y-8">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Investment Report</h2>
        <div className="flex gap-3 print:hidden">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors print:hidden"
          >
            Print Report
          </button>
          <button
            className="px-4 py-2 bg-gray-300 text-gray-500 rounded-lg text-sm font-medium cursor-not-allowed opacity-50 print:hidden"
            title="Coming soon"
            disabled
          >
            Download PDF
          </button>
        </div>
      </div>

      {/* A: Metrics Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {metricsCards.map((card) => (
          <div
            key={card.label}
            className={`${card.bg} rounded-xl shadow-sm border border-gray-100 p-4`}
          >
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {card.label}
            </p>
            <p className={`text-xl font-bold mt-1 ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* E: Red Flags */}
      {analysis.redFlags.length > 0 && (
        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-6">
          <h3 className="text-lg font-bold text-red-800 mb-3 flex items-center gap-2">
            <span className="text-xl">&#x26A0;&#xFE0F;</span> Red Flags
          </h3>
          <ul className="space-y-2">
            {analysis.redFlags.map((flag, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-red-500 mt-0.5 flex-shrink-0">&#x26A0;</span>
                <span className="text-red-700">{flag}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* B: Price Comparison Bar Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            Price per m&sup2; Comparison
          </h3>
          {priceComparison && (
            <p className="text-xs text-gray-400 mb-3">
              {priceComparison.city} (estimated)
            </p>
          )}
          {priceBarData ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={priceBarData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
                  label={{
                    value: "EUR/m\u00B2",
                    angle: -90,
                    position: "insideLeft",
                    style: { fontSize: 12 },
                  }}
                />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === "base") return [null, null];
                    return [formatEur(value), "EUR/m\u00B2"];
                  }}
                />
                {/* Invisible base for the stacked range bar */}
                <Bar dataKey="base" stackId="a" fill="transparent" />
                <Bar dataKey="value" stackId="a" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-gray-400 text-sm">
              Area comparison unavailable
            </div>
          )}
        </div>

        {/* D: Cost Breakdown Pie Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Acquisition Cost Breakdown
          </h3>
          {costSlices.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={costSlices}
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  dataKey="value"
                  label={({ name, value }: { name: string; value: number }) =>
                    `${name}: ${formatEur(value)}`
                  }
                  labelLine
                >
                  {costSlices.map((_entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={PIE_COLORS[index % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatEur(value)} />
                <Legend
                  formatter={(value: string, entry) => {
                    const payload = entry.payload as { value?: number } | undefined;
                    const amount = payload?.value;
                    return `${value} (${amount !== undefined ? formatEur(amount) : "\u2014"})`;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-gray-400 text-sm">
              Cost data not available
            </div>
          )}
        </div>
      </div>

      {/* C: Cash Flow Projection Line Chart */}
      {cashFlowData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Monthly Cash Flow Projection (25 Years)
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={cashFlowData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="year"
                tick={{ fontSize: 12 }}
                label={{
                  value: "Year",
                  position: "insideBottomRight",
                  offset: -5,
                  style: { fontSize: 12 },
                }}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(v: number) => `${v}\u20AC`}
                label={{
                  value: "EUR/month",
                  angle: -90,
                  position: "insideLeft",
                  style: { fontSize: 12 },
                }}
              />
              <Tooltip
                formatter={(value: number) => [`${formatEur(value)}/mo`, "Cash Flow"]}
                labelFormatter={(label: number) => `Year ${label}`}
              />
              <ReferenceLine y={0} stroke="#EF4444" strokeDasharray="3 3" />
              <Line
                type="stepAfter"
                dataKey="cashFlow"
                stroke="#3B82F6"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
          {metrics.assumptions.loanTermYears < 25 && (
            <p className="text-xs text-gray-400 mt-2">
              Mortgage ends in year {metrics.assumptions.loanTermYears} &mdash; cash flow
              increases once loan is paid off.
            </p>
          )}
        </div>
      )}

      {/* F: Investment Summary */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          Investment Summary
        </h3>
        <div className="text-gray-700 leading-relaxed space-y-4">
          {investmentSummary.split("\n\n").map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>
      </div>

      {/* G: Protocol Findings (compact) */}
      {hasProtocolFindings && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Protocol Findings
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {analysis.protocols.upcomingRenovations.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-700 text-sm mb-1">
                  Upcoming Renovations
                </h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  {analysis.protocols.upcomingRenovations.map((item, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-gray-400 mt-0.5">&bull;</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {analysis.protocols.sonderumlagen.length > 0 && (
              <div>
                <h4 className="font-medium text-orange-700 text-sm mb-1">
                  Sonderumlagen
                </h4>
                <ul className="text-sm text-orange-600 space-y-1">
                  {analysis.protocols.sonderumlagen.map((item, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-orange-400 mt-0.5">&bull;</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {analysis.protocols.maintenanceBacklog.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-700 text-sm mb-1">
                  Maintenance Backlog
                </h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  {analysis.protocols.maintenanceBacklog.map((item, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-gray-400 mt-0.5">&bull;</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {analysis.protocols.disputes.length > 0 && (
              <div>
                <h4 className="font-medium text-red-700 text-sm mb-1">Disputes</h4>
                <ul className="text-sm text-red-600 space-y-1">
                  {analysis.protocols.disputes.map((item, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-red-400 mt-0.5">&bull;</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* H: Renovation/Risk Timeline */}
      {analysis.protocols.upcomingRenovations.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Upcoming Renovations &amp; Risks
          </h3>
          <ul className="space-y-2">
            {analysis.protocols.upcomingRenovations.map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 flex-shrink-0 mt-0.5">
                  Renovation
                </span>
                <span className="text-gray-700 text-sm">{item}</span>
              </li>
            ))}
            {analysis.protocols.maintenanceBacklog.map((item, i) => (
              <li key={`backlog-${i}`} className="flex items-start gap-3">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 flex-shrink-0 mt-0.5">
                  Backlog
                </span>
                <span className="text-gray-700 text-sm">{item}</span>
              </li>
            ))}
            {analysis.wirtschaftsplan.plannedMajorWorks.map((item, i) => (
              <li key={`works-${i}`} className="flex items-start gap-3">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 flex-shrink-0 mt-0.5">
                  Planned
                </span>
                <span className="text-gray-700 text-sm">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
