"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { signOut } from "next-auth/react";
import AuthGuard from "@/app/components/AuthGuard";
import { STRIPE_ENABLED } from "@/lib/auth-config";

interface UsageData {
  tier: string;
  used: number;
  limit: number | null;
}

function AccountContent() {
  const { data: session } = useSession();
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    fetch("/api/usage")
      .then((r) => r.json())
      .then((data) => setUsage(data))
      .catch(() => {});
  }, []);

  async function handleManageSubscription() {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      // ignore
    } finally {
      setPortalLoading(false);
    }
  }

  return (
    <main className="bg-gray-50 min-h-screen">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Account</h1>

        <div className="space-y-4">
          {/* Profile */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex gap-4">
                <dt className="text-gray-500 w-20">Name</dt>
                <dd className="text-gray-900">{session?.user?.name || "\u2014"}</dd>
              </div>
              <div className="flex gap-4">
                <dt className="text-gray-500 w-20">Email</dt>
                <dd className="text-gray-900">{session?.user?.email || "\u2014"}</dd>
              </div>
            </dl>
          </div>

          {/* Usage */}
          {usage && (
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Usage</h2>
              <div className="text-sm">
                <div className="flex gap-4 mb-2">
                  <span className="text-gray-500 w-20">Plan</span>
                  <span className="text-gray-900 capitalize">{usage.tier}</span>
                </div>
                <div className="flex gap-4">
                  <span className="text-gray-500 w-20">Analyses</span>
                  <span className="text-gray-900">
                    {usage.used} / {usage.limit ?? "unlimited"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Subscription */}
          {STRIPE_ENABLED && (
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Subscription</h2>
              <button
                onClick={handleManageSubscription}
                disabled={portalLoading}
                className="text-sm bg-gray-900 hover:bg-gray-800 text-white font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {portalLoading ? "Loading..." : "Manage subscription"}
              </button>
            </div>
          )}

          {/* Sign out */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function AccountPage() {
  return (
    <AuthGuard>
      <AccountContent />
    </AuthGuard>
  );
}
