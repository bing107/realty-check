import { test, expect } from '@playwright/test';
import { blockPaidAPIs } from './helpers';

const TEST_EMAIL = process.env.E2E_TEST_EMAIL || 'e2e-test@realty-check.dev';
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || 'E2eTestPassword!123';

test.beforeEach(async ({ page }) => {
  await blockPaidAPIs(page);
});

test('sign up with new random email redirects to /analyze', async ({ page }) => {
  const randomEmail = `e2e-test-${Date.now()}@example.com`;
  await page.goto('/signup');
  await page.fill('input[type="email"], input[name="email"]', randomEmail);
  await page.fill('input[type="password"], input[name="password"]', 'TestPassword!123');
  await page.click('button[type="submit"]');
  // Should redirect to /analyze after signup
  await page.waitForURL(/\/(analyze|$)/, { timeout: 10_000 });
});

test('invalid credentials show error message', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[type="email"], input[name="email"]', 'nonexistent@example.com');
  await page.fill('input[type="password"], input[name="password"]', 'WrongPassword123');
  await page.click('button[type="submit"]');
  // Should show an error - wait a moment for response
  await page.waitForTimeout(2000);
  const bodyText = await page.locator('body').textContent();
  // Either still on login page or shows an error
  const isOnLogin = page.url().includes('/login');
  const hasError = bodyText?.toLowerCase().includes('invalid') ||
                   bodyText?.toLowerCase().includes('error') ||
                   bodyText?.toLowerCase().includes('incorrect');
  expect(isOnLogin || hasError).toBeTruthy();
});

test('/history redirects to /login when unauthenticated', async ({ page }) => {
  await page.goto('/history');
  await page.waitForURL(/\/login/, { timeout: 10_000 });
  await expect(page).toHaveURL(/\/login/);
});

test('/account redirects to /login when unauthenticated', async ({ page }) => {
  await page.goto('/account');
  await page.waitForURL(/\/login/, { timeout: 10_000 });
  await expect(page).toHaveURL(/\/login/);
});

test('sign in with test user credentials → session active', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[type="email"], input[name="email"]', TEST_EMAIL);
  await page.fill('input[type="password"], input[name="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  // After login, should not be on login page
  await page.waitForURL(/\/(analyze|history|account|$)/, { timeout: 10_000 });
  expect(page.url()).not.toMatch(/\/login/);
});

test('sign out redirects to landing or login', async ({ page }) => {
  // First sign in
  await page.goto('/login');
  await page.fill('input[type="email"], input[name="email"]', TEST_EMAIL);
  await page.fill('input[type="password"], input[name="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(analyze|history|account|$)/, { timeout: 10_000 });

  // Find and click sign out
  const signOutButton = page.getByRole('button', { name: /sign out|log out|logout/i });
  const signOutLink = page.getByRole('link', { name: /sign out|log out|logout/i });

  if (await signOutButton.isVisible()) {
    await signOutButton.click();
  } else if (await signOutLink.isVisible()) {
    await signOutLink.click();
  } else {
    // Try navigating to sign out endpoint directly
    await page.goto('/api/auth/signout');
    const submitButton = page.getByRole('button', { name: /sign out/i });
    if (await submitButton.isVisible()) {
      await submitButton.click();
    }
  }

  // Should be redirected away from protected pages
  await page.waitForURL(/\/(login|$)/, { timeout: 10_000 });
});
