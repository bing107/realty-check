import { Page } from '@playwright/test';

export async function blockPaidAPIs(page: Page) {
  // Block direct calls to paid third-party APIs
  await page.route('**/api.anthropic.com/**', route => route.abort());
  await page.route('**/api.stripe.com/**', route => route.abort());
  // Block the app's own API routes that call Anthropic server-side
  await page.route('**/api/analyze', route => route.abort());
  await page.route('**/api/summary', route => route.abort());
  await page.route('**/api/ocr', route => route.abort());
  // Block Stripe checkout/webhook routes
  await page.route('**/api/stripe/**', route => route.abort());
}
