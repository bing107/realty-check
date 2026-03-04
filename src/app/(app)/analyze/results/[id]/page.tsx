"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AuthGuard from "@/app/components/AuthGuard";
import ResultsDashboard from "@/app/components/ResultsDashboard";
import type { PriceComparison } from "@/app/components/ResultsDashboard";
import type { CalculatedMetrics } from "@/lib/calculator";
import type { AnalysisResult } from "@/lib/types";

interface SavedData {
  id: string;
  filename: string | null;
  createdAt: string;
  analysisJson: string;
  metrics: string | null;
  summary: string | null;
}

function ResultsContent() {
  const params = useParams();
  const id = params.id as string;

  const [saved, setSaved] = useState<SavedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/analyses/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setSaved(data.analysis);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load analysis");
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (error || !saved) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-700 mb-4">{error || "Analysis not found"}</p>
          <Link href="/history" className="text-blue-600 hover:underline text-sm">
            Back to History
          </Link>
        </div>
      </div>
    );
  }

  let analysis: AnalysisResult | null = null;
  let metrics: CalculatedMetrics | null = null;
  let investmentSummary: string | null = null;
  let priceComparison: PriceComparison | null = null;

  try {
    analysis = JSON.parse(saved.analysisJson);
    if (saved.metrics) metrics = JSON.parse(saved.metrics);
    if (saved.summary) {
      const s = JSON.parse(saved.summary);
      investmentSummary = s.investmentSummary || null;
      priceComparison = s.priceComparison || null;
    }
  } catch {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-700">Failed to parse analysis data</p>
      </div>
    );
  }

  if (!analysis || !metrics || !investmentSummary) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-700">Incomplete analysis data</p>
      </div>
    );
  }

  return (
    <main className="bg-gray-50 min-h-screen">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {saved.filename || "Analysis"}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {new Date(saved.createdAt).toLocaleDateString("de-DE", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </p>
          </div>
          <Link href="/history" className="text-sm text-blue-600 hover:underline">
            ← Back to History
          </Link>
        </div>
        <ResultsDashboard
          analysis={analysis}
          metrics={metrics}
          investmentSummary={investmentSummary}
          priceComparison={priceComparison}
        />
      </div>
    </main>
  );
}

export default function ResultsPage() {
  return (
    <AuthGuard>
      <ResultsContent />
    </AuthGuard>
  );
}
