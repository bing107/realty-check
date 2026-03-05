import { Page } from '@playwright/test';

export async function blockPaidAPIs(page: Page) {
  await page.route('**/api.anthropic.com/**', route => route.abort());
  await page.route('**/api.stripe.com/**', route => route.abort());
}
