import { expect, test, type Page } from '@playwright/test';

const ADMIN = { email: 'admin@lifelink.local', password: 'Admin@123!' };

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(ADMIN.email);
  await page.locator('input[type="password"]').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/app\/dashboard/);
  await expect(page.getByRole('heading', { name: /Good to see you/ })).toBeVisible();
}

test('unauthenticated workspace access redirects to sign in', async ({ page }) => {
  await page.goto('/app/dashboard');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});

test('admin dashboard loads live data and the request status filter refetches', async ({ page }) => {
  await login(page);

  await page.getByRole('navigation', { name: 'Sections' })
    .getByRole('link', { name: 'Emergency requests' }).click();
  await expect(page.getByLabel('Request status')).toBeVisible();

  const filtered = page.waitForRequest((request) =>
    request.url().includes('/api/v1/emergency-requests') && request.url().includes('status=APPROVED'));
  await page.getByLabel('Request status').selectOption('APPROVED');
  await filtered;
  await expect(page.getByLabel('Request status')).toHaveValue('APPROVED');
});

test('mobile navigation opens as a focusable dialog and closes on Escape', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);

  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  const dialog = page.getByRole('dialog', { name: 'Navigation menu' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'Dashboard' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});
