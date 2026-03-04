// Server-side: checks process.env directly
export const isAuthEnabled = !!(
  process.env.NEXTAUTH_SECRET && process.env.DATABASE_URL
);

// Client-side: uses NEXT_PUBLIC_ prefix
export const AUTH_ENABLED =
  process.env.NEXT_PUBLIC_AUTH_ENABLED === "true";
