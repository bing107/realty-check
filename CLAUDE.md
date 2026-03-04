# Realty Check

German real estate investment analysis tool. Upload broker PDFs, extract data via AI, calculate metrics, generate reports.

## Stack

- Next.js 15 (App Router), React 19, TypeScript strict
- Auth: NextAuth v5 (credentials + OAuth), JWT sessions
- DB: PostgreSQL + Prisma ORM
- AI: Anthropic Claude (claude-sonnet-4-6)
- PDF: pdfjs-dist 4.10.38 (client-side), pdf-parse (server-side)
- Payments: Stripe subscriptions
- Styling: Tailwind CSS
- Charts: Recharts
- Testing: Jest + React Testing Library

## Architecture

```
/                       Marketing landing page
/login, /signup         Auth pages (AuthForm component)
/analyze                Wizard flow (upload -> extract -> AI -> report)
/analyze/results/[id]   Saved result permalink (auth required)
/history                Past analyses (auth required)
/account                Settings + subscription (auth required)
/pricing                Pricing tiers
```

### Key Patterns

- `AUTH_ENABLED` (client) / `isAuthEnabled` (server) — feature flags for auth UI
- BYOK mode: users can provide their own Anthropic API key via `X-API-Key` header
- Usage tiers: free (1/mo), pro (30/mo), mentoring (unlimited)
- Wizard state is local React state — no cross-page state needed
- Auto-save analyses for logged-in non-BYOK users after report generation

## Known Gotchas

- **pdfjs-dist 4.x**: `page.render()` does NOT accept a `canvas` parameter. Use `{ canvasContext, viewport }` only. The `canvas` param was removed in v4 — do NOT re-add it.
- **pdfjs-dist version**: Pinned to 4.10.38. Do not upgrade — later versions have breaking changes.
- **Stripe URLs**: `success_url` -> `/analyze?checkout=success`, `cancel_url` -> `/pricing`, portal `return_url` -> `/account`
- **`tags` PATCH in Paperless replaces all tags** (not additive) — always GET current tags first
- **Port 80 is OMV**, not the app. App runs on port 3000 (dev).
- **Wizard race condition**: `canAnalyze` must include `&& !analyzeLoading && !summaryLoading` to prevent re-extraction during analysis
- **Metrics errors != analysis errors**: If `/api/calculate` fails after successful AI analysis, use a separate `metricsError` state — don't overwrite `analyzeError` since the analysis is still valid

## File Structure

- `src/app/page.tsx` — Landing page
- `src/app/(app)/analyze/page.tsx` — Wizard (main app logic)
- `src/app/(app)/analyze/results/[id]/page.tsx` — Result permalink
- `src/app/components/` — Shared components (Header, AuthForm, ResultsDashboard, etc.)
- `src/app/api/` — API routes (analyze, calculate, summary, ocr, analyses, stripe, auth)
- `src/lib/calculator.ts` — Pure investment metrics (no external deps)
- `src/lib/pdf-extract.ts` — Client-side PDF extraction + OCR batching
- `src/lib/usage.ts` — Usage quota management
- `src/auth.ts` — NextAuth config (signIn page: `/login`)
- `src/middleware.ts` — Route protection for /history, /account, /analyze/results/*

## Testing

- Jest for unit tests, React Testing Library for components
- Mock external deps: `@anthropic-ai/sdk`, Stripe, Prisma
- Run: `npm test`, typecheck: `npx tsc --noEmit`, build: `npm run build`
