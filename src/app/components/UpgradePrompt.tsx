"use client";

import { useState } from "react";
import { STRIPE_ENABLED } from "@/lib/auth-config";

interface UpgradePromptProps {
  onClose: () => void;
}

export default function UpgradePrompt({ onClose }: UpgradePromptProps) {
  const [loading, setLoading] = useState(false);

  async function handleUpgrade() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Analysis limit reached
        </h2>
        <p className="text-gray-600 mb-6">
          You have used your 1 free analysis this month. Upgrade to Pro for 30
          analyses/month.
        </p>

        {STRIPE_ENABLED && (
          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full py-3 rounded-xl font-semibold transition-colors bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed mb-3"
          >
            {loading ? "Redirecting..." : "Go Pro \u2014 5\u20AC/month"}
          </button>
        )}

        <p className="text-sm text-gray-500 text-center mb-4">
          Or use your own Anthropic API key to bypass all limits.
        </p>

        <button
          onClick={onClose}
          className="w-full py-2 rounded-xl font-medium text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-300 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}
