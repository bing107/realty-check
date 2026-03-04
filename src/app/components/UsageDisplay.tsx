"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { AUTH_ENABLED, STRIPE_ENABLED } from "@/lib/auth-config";

interface UsageData {
  tier: string;
  used: number;
  limit: number | null;
  periodStart: string;
}

interface UsageDisplayProps {
  apiKey: string;
}

export default function UsageDisplay({ apiKey }: UsageDisplayProps) {
  const { data: session } = useSession();
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  const isByok = !!apiKey;

  useEffect(() => {
    if (!AUTH_ENABLED || !session?.user || isByok) {
      setLoading(false);
      return;
    }

    fetch("/api/usage")
      .then((res) => res.json())
      .then((data) => {
        setUsage(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [session, isByok]);

  // Don't render if auth not enabled, not logged in, or BYOK mode
  if (!AUTH_ENABLED || !session?.user || isByok) {
    return null;
  }

  if (loading) {
    return (
      <div className="mt-4 text-sm text-gray-400">
        Loading usage...
      </div>
    );
  }

  if (!usage) {
    return null;
  }

  const isMentoring = usage.tier === "mentoring" || usage.limit === null;
  const tierLabel = usage.tier === "mentoring" ? "Mentoring+" : usage.tier === "pro" ? "Pro" : "Free";

  async function handleManageSubscription() {
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      // silent fail
    }
  }

  return (
    <div className="mt-4 flex items-center justify-between text-sm">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
          {tierLabel}
        </span>
        {isMentoring ? (
          <span className="text-gray-500">Unlimited analyses</span>
        ) : (
          <span className="text-gray-500">
            {usage.used} of {usage.limit} {usage.limit === 1 ? "analysis" : "analyses"} used this month
          </span>
        )}
      </div>
      {usage.tier === "pro" && STRIPE_ENABLED && (
        <button
          onClick={handleManageSubscription}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          Manage subscription
        </button>
      )}
    </div>
  );
}
