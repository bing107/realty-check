"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AuthGuard from "@/app/components/AuthGuard";

interface SavedAnalysis {
  id: string;
  filename: string | null;
  createdAt: string;
  metrics: string | null;
}

function getMetricPreview(metricsJson: string | null) {
  if (!metricsJson) return null;
  try {
    const m = JSON.parse(metricsJson);
    const parts: string[] = [];
    if (m.grossYield != null) parts.push(`${(m.grossYield * 100).toFixed(1)}% yield`);
    if (m.monthlyNet != null) {
      const sign = m.monthlyNet >= 0 ? "+" : "";
      parts.push(`${sign}\u20AC${Math.round(m.monthlyNet)}/mo`);
    }
    return parts.join(" \u00B7 ") || null;
  } catch {
    return null;
  }
}

function HistoryContent() {
  const [analyses, setAnalyses] = useState<SavedAnalysis[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analyses")
      .then((r) => r.json())
      .then((data) => {
        setAnalyses(data.analyses || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <main className="bg-gray-50 min-h-screen">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Past Analyses</h1>
          <Link
            href="/analyze"
            className="text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition-colors"
          >
            New Analysis
          </Link>
        </div>

        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : analyses.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <p className="text-gray-500 mb-4">No analyses yet</p>
            <Link href="/analyze" className="text-blue-600 hover:underline text-sm">
              Start your first analysis →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {analyses.map((a) => {
              const preview = getMetricPreview(a.metrics);
              return (
                <div
                  key={a.id}
                  className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {a.filename || "Untitled analysis"}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(a.createdAt).toLocaleDateString("de-DE", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                      {preview && ` \u00B7 ${preview}`}
                    </p>
                  </div>
                  <Link
                    href={`/analyze/results/${a.id}`}
                    className="flex-shrink-0 text-xs font-medium text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-400 rounded-lg px-3 py-1.5 transition-colors"
                  >
                    View
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

export default function HistoryPage() {
  return (
    <AuthGuard>
      <HistoryContent />
    </AuthGuard>
  );
}
