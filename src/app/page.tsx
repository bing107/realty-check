"use client";

import { useState } from "react";
import UploadZone from "./components/UploadZone";

export default function Home() {
  const [hasUploaded, setHasUploaded] = useState(false);

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
          <UploadZone onUploadedChange={setHasUploaded} />

          <button
            disabled={!hasUploaded}
            className={`w-full mt-6 py-3 rounded-xl font-semibold transition-colors ${
              hasUploaded
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
          >
            Analyze Documents
          </button>
        </div>
      </div>
    </main>
  );
}
