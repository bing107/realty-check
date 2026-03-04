"use client";

import { useState } from "react";
import Link from "next/link";
import { STRIPE_ENABLED } from "@/lib/auth-config";

const tiers = [
  {
    name: "Free",
    price: "0\u20AC",
    period: "/month",
    description: "Get started with real estate analysis",
    features: [
      "1 AI analysis per month",
      "Bring your own API key for unlimited use",
      "Full analysis reports",
    ],
    cta: null,
    highlighted: false,
  },
  {
    name: "Pro",
    price: "5\u20AC",
    period: "/month",
    description: "For active property investors",
    features: [
      "30 AI analyses per month",
      "Full analysis reports",
      "Priority support",
    ],
    cta: "Go Pro",
    highlighted: true,
  },
  {
    name: "Mentoring+",
    price: "Included",
    period: "with mentoring",
    description: "Unlimited access for mentoring participants",
    features: [
      "Unlimited AI analyses",
      "Full analysis reports",
      "1-on-1 mentoring sessions",
    ],
    cta: null,
    highlighted: false,
  },
];

export default function PricingPage() {
  const [loading, setLoading] = useState(false);

  async function handleCheckout() {
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
    <main className="bg-gray-50 min-h-screen">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="font-semibold text-gray-800">
            Realty Check
          </Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900">Pricing</h1>
          <p className="text-lg text-gray-500 mt-2">
            Choose the plan that fits your investment needs
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`bg-white rounded-2xl shadow-sm p-8 flex flex-col ${
                tier.highlighted
                  ? "ring-2 ring-blue-600 relative"
                  : "border border-gray-200"
              }`}
            >
              {tier.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                  Popular
                </span>
              )}

              <h2 className="text-xl font-bold text-gray-900">{tier.name}</h2>
              <div className="mt-4 flex items-baseline">
                <span className="text-4xl font-bold text-gray-900">
                  {tier.price}
                </span>
                <span className="ml-1 text-gray-500">{tier.period}</span>
              </div>
              <p className="mt-2 text-gray-500 text-sm">{tier.description}</p>

              <ul className="mt-6 space-y-3 flex-1">
                {tier.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2 text-sm text-gray-700"
                  >
                    <svg
                      className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                {tier.cta && STRIPE_ENABLED ? (
                  <button
                    onClick={handleCheckout}
                    disabled={loading}
                    className="w-full py-3 rounded-xl font-semibold transition-colors bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? "Redirecting..." : tier.cta}
                  </button>
                ) : tier.name === "Free" ? (
                  <Link
                    href="/"
                    className="block w-full py-3 rounded-xl font-semibold text-center border border-gray-200 text-gray-700 hover:border-gray-300 transition-colors"
                  >
                    Get started
                  </Link>
                ) : tier.name === "Mentoring+" ? (
                  <span className="block w-full py-3 rounded-xl font-semibold text-center text-gray-400 border border-gray-100">
                    Contact us
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
