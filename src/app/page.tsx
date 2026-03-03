"use client";

import { useState } from "react";
import UploadZone from "./components/UploadZone";

interface ExtractResult {
  filename: string;
  pages: number;
  text: string;
  extractedAt: string;
}

interface ExtractError {
  filename: string;
  error: string;
}

export default function Home() {
  const [savedFiles, setSavedFiles] = useState<string[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [extractResults, setExtractResults] = useState<ExtractResult[] | null>(
    null
  );
  const [extractErrors, setExtractErrors] = useState<ExtractError[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);

  async function handleAnalyze() {
    setExtracting(true);
    setFetchError(null);
    setExtractErrors([]);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: savedFiles }),
      });
      const data = await res.json();
      setExtractResults(data.results);
      setExtractErrors(data.errors ?? []);
    } catch {
      setFetchError("Failed to extract documents. Please try again.");
    } finally {
      setExtracting(false);
    }
  }

  const canAnalyze = savedFiles.length > 0 && !extracting;

  return (
    <main className="bg-gray-50 min-h-screen">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Realty Check</h1>
          <p className="text-lg text-gray-500 mt-2">
            Upload broker documents for AI-powered investment analysis
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-8">
          <UploadZone onUploadedChange={setSavedFiles} />

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

        {extractResults !== null && (
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
      </div>
    </main>
  );
}
