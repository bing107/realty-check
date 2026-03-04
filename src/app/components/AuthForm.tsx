"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { track } from "@/lib/analytics";

interface AuthFormProps {
  mode: "signin" | "signup";
}

function AuthFormInner({ mode }: AuthFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawCallbackUrl = searchParams.get("callbackUrl") || "/analyze";
  const callbackUrl =
    rawCallbackUrl.startsWith("/") && !rawCallbackUrl.startsWith("//")
      ? rawCallbackUrl
      : "/analyze";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError("Invalid email or password");
    } else {
      track('login_completed', { method: 'credentials' });
      router.push(callbackUrl);
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Sign up failed");
        setLoading(false);
        return;
      }
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      setLoading(false);
      if (result?.error) {
        setError("Account created. Please sign in.");
      } else {
        track('signup_completed');
        router.push(callbackUrl);
      }
    } catch {
      setError("Sign up failed. Please try again.");
      setLoading(false);
    }
  }

  if (mode === "signin") {
    return (
      <form onSubmit={handleSignIn} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="--------"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
        <p className="text-center text-sm text-gray-500">
          Don&apos;t have an account?{" "}
          <Link href={`/signup${callbackUrl !== "/analyze" ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`} className="text-blue-600 hover:underline">
            Sign up
          </Link>
        </p>
      </form>
    );
  }

  return (
    <form onSubmit={handleSignUp} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name (optional)</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Your name"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Min. 8 characters"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition-colors disabled:opacity-50"
      >
        {loading ? "Creating account..." : "Create account"}
      </button>
      <p className="text-center text-sm text-gray-500">
        Already have an account?{" "}
        <Link href={`/login${callbackUrl !== "/analyze" ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`} className="text-blue-600 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export default function AuthForm({ mode }: AuthFormProps) {
  return (
    <Suspense>
      <AuthFormInner mode={mode} />
    </Suspense>
  );
}
