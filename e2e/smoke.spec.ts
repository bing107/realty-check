import { test, expect } from '@playwright/test';
import { blockPaidAPIs } from './helpers';

test.beforeEach(async ({ page }) => {
  await blockPaidAPIs(page);
});

test('landing page loads with hero and CTA', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Realty Check|Know Before You Buy/i);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: /analyze/i })).toBeVisible();
});

test('/analyze loads with upload zone', async ({ page }) => {
  await page.goto('/analyze');
  // Should either show upload zone or redirect to login
  const url = page.url();
  if (url.includes('/login')) {
    await expect(page.getByRole('heading', { name: /sign in|log in/i })).toBeVisible();
  } else {
    // Upload zone or dropzone should be visible
    await expect(page.locator('[data-testid="dropzone"], [class*="dropzone"], input[type="file"]').first()).toBeAttached();
  }
});

test('/pricing loads with tier cards', async ({ page }) => {
  await page.goto('/pricing');
  await expect(page).toHaveURL(/\/pricing/);
  // Pricing page should display pricing-related content
  const bodyText = await page.locator('body').textContent();
  expect(bodyText?.toLowerCase()).toMatch(/free|pro|pricing|plan|month/i);
});

test('/login loads with email/password form', async ({ page }) => {
  await page.goto('/login');
  await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"], input[name="password"]')).toBeVisible();
});

test('/signup loads with registration form', async ({ page }) => {
  await page.goto('/signup');
  await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"], input[name="password"]')).toBeVisible();
});
