/**
 * E2E: Auth flow (Register → Login → Dashboard).
 * Purpose: Real user behavior; catch regressions in auth and role routing.
 * Run: npx playwright test e2e/auth.spec.ts
 * Failure: Auth or navigation broken; fix before release.
 */
import { test, expect } from '@playwright/test';

test.describe('Auth flow', () => {
  test('Login screen renders and shows validation on empty submit', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /log in/i })).toBeVisible();
    await page.getByRole('button', { name: /log in/i }).click();
    await expect(page.getByText(/enter email|required/i)).toBeVisible({ timeout: 5000 });
  });

  test('Navigate to Register from Login', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /sign up|register/i }).first().click();
    await expect(page.getByText(/create account|sign up/i)).toBeVisible({ timeout: 5000 });
  });

  test('Invalid login shows error', async ({ page }) => {
    await page.goto('/');
    await page.getByPlaceholder(/email/i).fill('invalid@test.com');
    await page.getByPlaceholder(/password/i).fill('WrongPass123');
    await page.getByRole('button', { name: /log in/i }).click();
    await expect(page.getByText(/invalid|incorrect|error/i)).toBeVisible({ timeout: 10000 });
  });
});
