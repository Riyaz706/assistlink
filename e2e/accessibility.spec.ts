/**
 * E2E: Accessibility (basic a11y checks).
 * Purpose: Fail if critical a11y regressions (labels, roles).
 * Run: npx playwright test e2e/accessibility.spec.ts
 * Failure: Accessibility regression; fix before release.
 */
import { test, expect } from '@playwright/test';

test.describe('Accessibility', () => {
  test('Login has focusable inputs and button', async ({ page }) => {
    await page.goto('/');
    const email = page.getByPlaceholder(/email/i).first();
    const password = page.getByPlaceholder(/password/i).first();
    const submit = page.getByRole('button', { name: /log in/i });
    await expect(email).toBeVisible({ timeout: 8000 });
    await expect(password).toBeVisible();
    await expect(submit).toBeVisible();
    await email.focus();
    await expect(email).toBeFocused();
  });

  test('No duplicate main landmarks on login', async ({ page }) => {
    await page.goto('/');
    const mains = page.getByRole('main');
    const count = await mains.count();
    expect(count).toBeLessThanOrEqual(1);
  });
});
