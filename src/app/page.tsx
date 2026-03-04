"use client";

import { useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import UploadZone from "./components/UploadZone";
import ApiKeyInput from "./components/ApiKeyInput";
import ResultsDashboard from "./components/ResultsDashboard";
import AuthModal from "./components/AuthModal";
import UserMenu from "./components/UserMenu";
import AnalysisHistory from "./components/AnalysisHistory";
import UsageDisplay from "./components/UsageDisplay";
import UpgradePrompt from "./components/UpgradePrompt";
import type { PriceComparison } from "./components/ResultsDashboard";
import type { CalculatedMetrics } from "@/lib/calculator";
import { extractTextFromPdf, type ExtractResult } from "@/lib/pdf-extract";
import { AUTH_ENABLED } from "@/lib/auth-config";

interface ExtractError {
  filename: string;
  error: string;
}

interface AnalysisResult {
  property: {
    address: string | null;
    sqm: number | null;
    units: number | null;
    yearBuilt: number | null;
    type: "ETW" | "MFH" | "other" | null;
  };
  financials: {
    purchasePrice: number | null;
    hausgeld: number | null;
    ruecklage: number | null;
    currentRent: number | null;
    expectedRent: number | null;
    grunderwerbsteuer: number | null;
    notarFees: number | null;
    maklerFees: number | null;
  };
  protocols: {
    upcomingRenovations: string[];
    sonderumlagen: string[];
    maintenanceBacklog: string[];
    disputes: string[];
  };
  wirtschaftsplan: {
    annualBudget: number | null;
    reserveFundStatus: string | null;
    plannedMajorWorks: string[];
  };
  redFlags: string[];
  summary: string;
}

interface SavedAnalysis {
  analysisJson: string;
  metrics: string | null;
  summary: string | null;
}

function formatEur(value: number | null): string {
  if (value === null) return "\u2014";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function Home() {
  const [apiKey, setApiKey] = useState("");
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [extractResults, setExtractResults] = useState<ExtractResult[] | null>(
    null
  );
  const [extractErrors, setExtractErrors] = useState<ExtractError[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const [metrics, setMetrics] = useState<CalculatedMetrics | null>(null);
  const [investmentSummary, setInvestmentSummary] = useState<string | null>(
    null
  );
  const [priceComparison, setPriceComparison] =
    useState<PriceComparison | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Auth state
  const { data: session } = useSession();
  const [showAuthModal, setShowAuthModal] = useState<
    "signin" | "signup" | null
  >(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  const handleFilesChange = useCallback((files: File[]) => {
    setPdfFiles(files);
  }, []);

  function handleViewSaved(saved: SavedAnalysis) {
    try {
      const parsedAnalysis = JSON.parse(saved.analysisJson);
      const parsedMetrics = saved.metrics ? JSON.parse(saved.metrics) : null;
      const parsedSummary = saved.summary ? JSON.parse(saved.summary) : null;

      setAnalysis(parsedAnalysis);
      setMetrics(parsedMetrics);
      if (parsedSummary) {
        setInvestmentSummary(parsedSummary.investmentSummary || null);
        setPriceComparison(parsedSummary.priceComparison || null);
      }
      // Scroll to top
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      // ignore parse errors
    }
  }

  async function handleAnalyze() {
    setExtracting(true);
    setFetchError(null);
    setExtractErrors([]);
    try {
      const results: ExtractResult[] = [];
      const errors: ExtractError[] = [];

      for (const file of pdfFiles) {
        try {
          const result = await extractTextFromPdf(file);
          results.push(result);
        } catch (err) {
          errors.push({
            filename: file.name,
            error: err instanceof Error ? err.message : "Failed to extract",
          });
        }
      }

      // OCR scanned documents
      for (const result of results) {
        if (result.isScanned && result.images && result.images.length > 0) {
          try {
            const ocrRes = await fetch("/api/ocr", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-API-Key": apiKey,
              },
              body: JSON.stringify({
                images: result.images,
                filename: result.filename,
              }),
            });
            const ocrData = await ocrRes.json();
            if (ocrRes.ok) {
              result.text = ocrData.text;
            } else {
              errors.push({
                filename: result.filename,
                error: "OCR failed: " + ocrData.error,
              });
            }
          } catch {
            errors.push({
              filename: result.filename,
              error: "OCR failed: network error",
            });
          }
        }
      }

      setExtractResults(results);
      setExtractErrors(errors);
    } catch {
      setFetchError("Failed to extract documents. Please try again.");
    } finally {
      setExtracting(false);
    }
  }

  async function handleAiAnalysis() {
    if (!extractResults) return;
    setAnalyzeLoading(true);
    setAnalyzeError(null);
    try {
      const texts = extractResults
        .filter((r) => r.text && !r.text.startsWith("OCR not supported"))
        .map((r) => ({ filename: r.filename, text: r.text }));

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
        body: JSON.stringify({ texts }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403 && data.error === "limit_reached") {
          setShowUpgradePrompt(true);
          return;
        }
        setAnalyzeError(data.error || "Analysis failed");
        return;
      }
      setAnalysis(data.analysis);

      // Auto-call calculate after analysis succeeds
      try {
        const calcRes = await fetch("/api/calculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ analysis: data.analysis }),
        });
        const calcData = await calcRes.json();
        if (calcRes.ok) {
          setMetrics(calcData.metrics);
        }
      } catch {
        // Calculator failure is non-fatal; user can still see analysis
      }
    } catch {
      setAnalyzeError("Failed to analyze documents. Please try again.");
    } finally {
      setAnalyzeLoading(false);
    }
  }

  async function handleGenerateReport() {
    if (!analysis || !metrics) return;
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const res = await fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
        body: JSON.stringify({ analysis, metrics }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSummaryError(data.error || "Summary generation failed");
        return;
      }
      setInvestmentSummary(data.investmentSummary);
      setPriceComparison(data.priceComparison ?? null);

      // Auto-save for logged-in users
      if (AUTH_ENABLED && session?.user?.id) {
        const filename =
          pdfFiles.length > 0 ? pdfFiles[0].name : undefined;
        fetch("/api/analyses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename,
            analysisJson: analysis,
            metrics,
            summary: {
              investmentSummary: data.investmentSummary,
              priceComparison: data.priceComparison ?? null,
            },
          }),
        })
          .then(() => setHistoryRefreshKey((k) => k + 1))
          .catch(() => {}); // silent fail
      }
    } catch {
      setSummaryError("Failed to generate report. Please try again.");
    } finally {
      setSummaryLoading(false);
    }
  }

  const canAnalyze = pdfFiles.length > 0 && !extracting;
  const hasUsableExtracts =
    extractResults !== null &&
    extractResults.some(
      (r) => r.text && !r.text.startsWith("OCR not supported")
    );
  const canRunAi = hasUsableExtracts && !analyzeLoading;

  const showDashboard =
    analysis !== null && metrics !== null && investmentSummary !== null;
  const canGenerateReport =
    analysis !== null && metrics !== null && !summaryLoading && !showDashboard;

  return (
    <>
      {AUTH_ENABLED && (
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <span className="font-semibold text-gray-800">Realty Check</span>
            <div className="flex items-center gap-3">
              <Link
                href="/pricing"
                className="text-sm text-gray-600 hover:text-gray-900 font-medium"
              >
                Pricing
              </Link>
              {session?.user ? (
                <UserMenu user={session.user} />
              ) : (
                <>
                  <button
                    onClick={() => setShowAuthModal("signin")}
                    className="text-sm text-gray-600 hover:text-gray-900 font-medium"
                  >
                    Sign in
                  </button>
                  <button
                    onClick={() => setShowAuthModal("signup")}
                    className="text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-1.5 rounded-lg transition-colors"
                  >
                    Sign up
                  </button>
                </>
              )}
            </div>
          </div>
        </header>
      )}

      <main className="bg-gray-50 min-h-screen">
        <div className="max-w-5xl mx-auto px-4 py-16">
          {AUTH_ENABLED && session?.user && (
            <AnalysisHistory
              onView={handleViewSaved}
              refreshKey={historyRefreshKey}
            />
          )}

          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900">Realty Check</h1>
            <p className="text-lg text-gray-500 mt-2">
              Upload broker documents for AI-powered investment analysis
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-8">
            <ApiKeyInput value={apiKey} onChange={setApiKey} />
            {AUTH_ENABLED && session?.user && (
              <UsageDisplay apiKey={apiKey} />
            )}
            <UploadZone onFilesChange={handleFilesChange} />

            <button
              disabled={!canAnalyze}
              onClick={handleAnalyze}
              className={`w-full mt-6 py-3 rounded-xl font-semibold transition-colors ${
                canAnalyze
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              {extracting ? "Extracting..." : "Analyze Documents"}
            </button>
          </div>

          {fetchError && (
            <div className="mt-8 bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-red-700">{fetchError}</p>
            </div>
          )}

          {extractErrors.length > 0 && (
            <div className="mt-8 space-y-2">
              <h2 className="text-xl font-semibold text-red-700">
                Extraction Errors
              </h2>
              {extractErrors.map((err) => (
                <div
                  key={err.filename}
                  className="bg-red-50 border border-red-200 rounded-xl p-4"
                >
                  <span className="font-medium text-gray-800">
                    {err.filename}:
                  </span>{" "}
                  <span className="text-red-600">{err.error}</span>
                </div>
              ))}
            </div>
          )}

          {extractResults !== null && !showDashboard && (
            <div className="mt-8 space-y-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Extraction Results
              </h2>
              {extractResults.map((result) => (
                <div
                  key={result.filename}
                  className="bg-white rounded-xl shadow-sm p-6"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-800">
                      {result.filename}
                      {result.isScanned &&
                        !result.text.startsWith("OCR not supported") && (
                          <span className="ml-2 text-xs font-semibold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                            OCR
                          </span>
                        )}
                    </h3>
                    <span className="text-sm text-gray-500">
                      {result.pages} page{result.pages !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 whitespace-pre-line">
                    {result.text.length > 200
                      ? `${result.text.slice(0, 200)}...`
                      : result.text}
                  </p>
                </div>
              ))}
            </div>
          )}

          {canRunAi && !showDashboard && (
            <div className="mt-8">
              <button
                disabled={analyzeLoading}
                onClick={handleAiAnalysis}
                className={`w-full py-3 rounded-xl font-semibold transition-colors ${
                  analyzeLoading
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : "bg-green-600 hover:bg-green-700 text-white"
                }`}
              >
                {analyzeLoading ? "Analyzing with AI..." : "Analyze with AI"}
              </button>
            </div>
          )}

          {analyzeError && (
            <div className="mt-8 bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-red-700">{analyzeError}</p>
            </div>
          )}

          {/* Show raw analysis before dashboard is ready */}
          {analysis && !showDashboard && (
            <div className="mt-8 space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">
                AI Analysis Results
              </h2>

              {/* Summary */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Summary
                </h3>
                <p className="text-gray-700">{analysis.summary}</p>
              </div>

              {/* Red Flags */}
              {analysis.redFlags.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-red-800 mb-3">
                    Red Flags
                  </h3>
                  <ul className="space-y-2">
                    {analysis.redFlags.map((flag, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-red-500 mt-0.5">&#x26A0;</span>
                        <span className="text-red-700">{flag}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Property Basics */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  Property
                </h3>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <dt className="text-gray-500">Address</dt>
                  <dd className="text-gray-900">
                    {analysis.property.address ?? "\u2014"}
                  </dd>
                  <dt className="text-gray-500">Size</dt>
                  <dd className="text-gray-900">
                    {analysis.property.sqm != null
                      ? `${analysis.property.sqm} m\u00B2`
                      : "\u2014"}
                  </dd>
                  <dt className="text-gray-500">Units</dt>
                  <dd className="text-gray-900">
                    {analysis.property.units ?? "\u2014"}
                  </dd>
                  <dt className="text-gray-500">Year Built</dt>
                  <dd className="text-gray-900">
                    {analysis.property.yearBuilt ?? "\u2014"}
                  </dd>
                  <dt className="text-gray-500">Type</dt>
                  <dd className="text-gray-900">
                    {analysis.property.type ?? "\u2014"}
                  </dd>
                </dl>
              </div>

              {/* Financials */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  Financials
                </h3>
                <table className="w-full text-sm">
                  <tbody>
                    {[
                      ["Purchase Price", analysis.financials.purchasePrice],
                      ["Hausgeld (monthly)", analysis.financials.hausgeld],
                      [
                        "Instandhaltungsr\u00FCcklage",
                        analysis.financials.ruecklage,
                      ],
                      ["Current Rent", analysis.financials.currentRent],
                      ["Expected Rent", analysis.financials.expectedRent],
                      [
                        "Grunderwerbsteuer",
                        analysis.financials.grunderwerbsteuer,
                      ],
                      ["Notar Fees", analysis.financials.notarFees],
                      ["Makler Fees", analysis.financials.maklerFees],
                    ].map(([label, value]) => (
                      <tr
                        key={label as string}
                        className="border-b last:border-0"
                      >
                        <td className="py-2 text-gray-500">
                          {label as string}
                        </td>
                        <td className="py-2 text-right text-gray-900 font-medium">
                          {formatEur(value as number | null)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Protocol Findings */}
              {(analysis.protocols.upcomingRenovations.length > 0 ||
                analysis.protocols.sonderumlagen.length > 0 ||
                analysis.protocols.maintenanceBacklog.length > 0 ||
                analysis.protocols.disputes.length > 0) && (
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    Protocol Findings
                  </h3>
                  <div className="space-y-4">
                    {analysis.protocols.upcomingRenovations.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-700 mb-1">
                          Upcoming Renovations
                        </h4>
                        <ul className="list-disc list-inside text-sm text-gray-600">
                          {analysis.protocols.upcomingRenovations.map(
                            (item, i) => (
                              <li key={i}>{item}</li>
                            )
                          )}
                        </ul>
                      </div>
                    )}
                    {analysis.protocols.sonderumlagen.length > 0 && (
                      <div>
                        <h4 className="font-medium text-orange-700 mb-1">
                          Sonderumlagen
                        </h4>
                        <ul className="list-disc list-inside text-sm text-orange-600">
                          {analysis.protocols.sonderumlagen.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {analysis.protocols.maintenanceBacklog.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-700 mb-1">
                          Maintenance Backlog
                        </h4>
                        <ul className="list-disc list-inside text-sm text-gray-600">
                          {analysis.protocols.maintenanceBacklog.map(
                            (item, i) => (
                              <li key={i}>{item}</li>
                            )
                          )}
                        </ul>
                      </div>
                    )}
                    {analysis.protocols.disputes.length > 0 && (
                      <div>
                        <h4 className="font-medium text-red-700 mb-1">
                          Disputes
                        </h4>
                        <ul className="list-disc list-inside text-sm text-red-600">
                          {analysis.protocols.disputes.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Wirtschaftsplan */}
              {(analysis.wirtschaftsplan.annualBudget !== null ||
                analysis.wirtschaftsplan.reserveFundStatus !== null ||
                analysis.wirtschaftsplan.plannedMajorWorks.length > 0) && (
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    Wirtschaftsplan
                  </h3>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-3">
                    <dt className="text-gray-500">Annual Budget</dt>
                    <dd className="text-gray-900">
                      {formatEur(analysis.wirtschaftsplan.annualBudget)}
                    </dd>
                    <dt className="text-gray-500">Reserve Fund Status</dt>
                    <dd className="text-gray-900">
                      {analysis.wirtschaftsplan.reserveFundStatus ?? "\u2014"}
                    </dd>
                  </dl>
                  {analysis.wirtschaftsplan.plannedMajorWorks.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-700 mb-1 text-sm">
                        Planned Major Works
                      </h4>
                      <ul className="list-disc list-inside text-sm text-gray-600">
                        {analysis.wirtschaftsplan.plannedMajorWorks.map(
                          (item, i) => (
                            <li key={i}>{item}</li>
                          )
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Generate Full Report button */}
          {canGenerateReport && (
            <div className="mt-8">
              <button
                disabled={summaryLoading}
                onClick={handleGenerateReport}
                className={`w-full py-3 rounded-xl font-semibold transition-colors ${
                  summaryLoading
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white"
                }`}
              >
                {summaryLoading
                  ? "Generating Full Report..."
                  : "Generate Full Report"}
              </button>
            </div>
          )}

          {summaryError && (
            <div className="mt-8 bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-red-700">{summaryError}</p>
            </div>
          )}

          {/* Full Results Dashboard */}
          {showDashboard && (
            <ResultsDashboard
              analysis={analysis}
              metrics={metrics}
              investmentSummary={investmentSummary}
              priceComparison={priceComparison}
            />
          )}
        </div>

        {showAuthModal && (
          <AuthModal
            onClose={() => setShowAuthModal(null)}
            defaultTab={showAuthModal}
          />
        )}

        {showUpgradePrompt && (
          <UpgradePrompt onClose={() => setShowUpgradePrompt(false)} />
        )}
      </main>
    </>
  );
}
