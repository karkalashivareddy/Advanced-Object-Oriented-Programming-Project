import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

const EVIDENCE_DIR = resolve(process.cwd(), '../docs/evidence/screenshots');

async function expectNoPageOverflow(page: import('@playwright/test').Page, label: string) {
  const widths = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    bodyWidth: document.body.scrollWidth,
  }));

  expect(widths.documentWidth, `${label}: document overflow`).toBeLessThanOrEqual(widths.viewportWidth);
  expect(widths.bodyWidth, `${label}: body overflow`).toBeLessThanOrEqual(widths.viewportWidth);
}

test.beforeAll(() => {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
});

test('landing page tells the donor-to-delivery story on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Every\s+Drop\s+Has\s+a\s+Destination\./i);
  await expect(page.getByRole('group', { name: 'Donor to delivery journey' }).locator('li'))
    .toHaveCount(6);
  for (const stage of ['Donate', 'Screen', 'Store', 'Request', 'Reserve', 'Deliver']) {
    await expect(page.getByRole('heading', { name: stage, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('img', { name: /Illustrative animated blood vessel/i })).toBeVisible();
  await expect(page.getByText(/Visual story only · not live supply data/i)).toBeVisible();

  const primary = page.getByRole('link', { name: /Become a donor/i }).first();
  const signIn = page.getByRole('link', { name: /Find Blood/i }).first();
  await expect(primary).toHaveAttribute('href', '/register');
  await expect(signIn).toHaveAttribute('href', '/login');

  await expectNoPageOverflow(page, 'landing desktop');
  await page.screenshot({ path: resolve(EVIDENCE_DIR, 'landing-after-desktop.png'), fullPage: true });
});

test('landing page remains readable and contained on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible();
  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible();

  await expectNoPageOverflow(page, 'landing mobile');
  await page.screenshot({ path: resolve(EVIDENCE_DIR, 'landing-after-mobile.png'), fullPage: true });
});

test('reduced motion removes SMIL cell animation and CSS flow animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  await expect(page.getByRole('img', { name: /Illustrative animated blood vessel/i })).toBeVisible();
  expect(await page.locator('animateMotion').count()).toBe(0);
  await expect(page.locator('.bloodstream-visual__flow').first())
    .toHaveCSS('animation-name', 'none');
  await page.screenshot({ path: resolve(EVIDENCE_DIR, 'landing-after-reduced-motion.png'), fullPage: true });
});

test('keyboard users can skip the landing navigation', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');

  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main-content$/);
});
