"use client";

import { useEffect, useState } from "react";

interface SavedAnalysis {
  id: string;
  filename: string | null;
  createdAt: string;
  analysisJson: string;
  metrics: string | null;
  summary: string | null;
}

interface AnalysisHistoryProps {
  onView: (analysis: SavedAnalysis) => void;
  refreshKey?: number;
}

export default function AnalysisHistory({
  onView,
  refreshKey,
}: AnalysisHistoryProps) {
  const [analyses, setAnalyses] = useState<SavedAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    fetch("/api/analyses")
      .then((r) => r.json())
      .then((data) => {
        setAnalyses(data.analyses || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [refreshKey]);

  if (loading) return null;
  if (analyses.length === 0) return null;

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function getMetricPreview(metricsJson: string | null) {
    if (!metricsJson) return null;
    try {
      const m = JSON.parse(metricsJson);
      const parts: string[] = [];
      if (m.grossYield != null)
        parts.push(`${(m.grossYield * 100).toFixed(1)}% yield`);
      if (m.monthlyNet != null) {
        const sign = m.monthlyNet >= 0 ? "+" : "";
        parts.push(`${sign}\u20AC${Math.round(m.monthlyNet)}/mo`);
      }
      return parts.join(" \u00B7 ") || null;
    } catch {
      return null;
    }
  }

  return (
    <div className="mb-8">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-gray-700 font-semibold text-sm mb-3 hover:text-gray-900 transition-colors"
      >
        <svg
          className={`w-4 h-4 transition-transform ${open ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
        Past analyses ({analyses.length})
      </button>

      {open && (
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
                    {formatDate(a.createdAt)}
                    {preview && ` \u00B7 ${preview}`}
                  </p>
                </div>
                <button
                  onClick={() => onView(a)}
                  className="flex-shrink-0 text-xs font-medium text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-400 rounded-lg px-3 py-1.5 transition-colors"
                >
                  View
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
