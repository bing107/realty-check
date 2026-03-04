"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { AUTH_ENABLED } from "@/lib/auth-config";
import UserMenu from "./UserMenu";

export default function Header() {
  const { data: session } = useSession();

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="font-semibold text-gray-800">
          Realty Check
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/pricing"
            className="text-sm text-gray-600 hover:text-gray-900 font-medium"
          >
            Pricing
          </Link>
          {AUTH_ENABLED && session?.user && (
            <Link
              href="/history"
              className="text-sm text-gray-600 hover:text-gray-900 font-medium"
            >
              History
            </Link>
          )}
          {AUTH_ENABLED && (
            session?.user ? (
              <UserMenu user={session.user} />
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm text-gray-600 hover:text-gray-900 font-medium"
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  className="text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-1.5 rounded-lg transition-colors"
                >
                  Sign up
                </Link>
              </>
            )
          )}
        </div>
      </div>
    </header>
  );
}
