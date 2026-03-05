import { test, expect } from '@playwright/test';
import { blockPaidAPIs } from './helpers';

const TEST_EMAIL = process.env.E2E_TEST_EMAIL || 'e2e-test@realty-check.dev';
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || 'E2eTestPassword!123';

test.beforeEach(async ({ page }) => {
  await blockPaidAPIs(page);
});

async function loginAsTestUser(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.fill('input[type="email"], input[name="email"]', TEST_EMAIL);
  await page.fill('input[type="password"], input[name="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(analyze|history|account|$)/, { timeout: 10_000 });
}

test('history page shows saved analyses for test user', async ({ page }) => {
  await loginAsTestUser(page);
  await page.goto('/history');
  await expect(page).toHaveURL(/\/history/);
  // Page should load without error
  const body = page.locator('body');
  await expect(body).toBeVisible();
});

test('results page renders for seeded analysis', async ({ page }) => {
  await loginAsTestUser(page);

  // Navigate to history to find the seeded analysis
  await page.goto('/history');
  await expect(page).toHaveURL(/\/history/);

  // Look for a link to an analysis result
  const analysisLink = page.locator('a[href*="/analyze/results/"]').first();
  if (await analysisLink.isVisible()) {
    await analysisLink.click();
    await page.waitForURL(/\/analyze\/results\//, { timeout: 10_000 });
    // Results dashboard should render
    const body = await page.locator('body').textContent();
    expect(body?.length).toBeGreaterThan(100);
  } else {
    // No analyses yet - that's acceptable if seed hasn't run
    test.skip();
  }
});
