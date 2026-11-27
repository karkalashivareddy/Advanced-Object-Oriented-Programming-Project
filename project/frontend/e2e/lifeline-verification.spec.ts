import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

const EVIDENCE_DIR = resolve(process.cwd(), '../docs/evidence/screenshots');
const WIDTHS = [360, 390, 768, 1024, 1280, 1536];

test.beforeAll(() => {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
});

test('lifeline landing stays contained at every target breakpoint', async ({ page }, testInfo) => {
  const consoleIssues: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      consoleIssues.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => consoleIssues.push(`pageerror: ${error.message}`));

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Every Drop Has a Destination.');

    const layout = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      bodyWidth: document.body.scrollWidth,
    }));
    expect(layout.documentWidth, `${width}px document overflow`).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.bodyWidth, `${width}px body overflow`).toBeLessThanOrEqual(layout.viewportWidth);

    await page.screenshot({
      path: resolve(EVIDENCE_DIR, `lifeline-landing-${width}.png`),
      fullPage: true,
    });
  }

  await testInfo.attach('lifeline-console', {
    body: JSON.stringify(consoleIssues, null, 2),
    contentType: 'application/json',
  });
  expect(consoleIssues, consoleIssues.join('\n')).toEqual([]);
});

test('compatibility atlas is keyboard operable and keeps the exact clinical note', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');

  const recipients = page.getByRole('group', { name: 'Choose a recipient blood group' });
  const oNegative = recipients.getByRole('button', { name: 'O negative' });
  await oNegative.focus();
  await oNegative.click();
  await expect(page.locator('.compat-summary .sr-only')).toHaveText('1');
  await expect(page.getByRole('status')).toContainText(/for O negative recipients/i);

  const abPositive = recipients.getByRole('button', { name: 'AB positive' });
  await abPositive.focus();
  await abPositive.click();
  await expect(page.locator('.compat-summary .sr-only')).toHaveText('8');
  await expect(page.getByRole('status')).toContainText(/for AB positive recipients/i);

  await expect(
    page.getByText(
      'Red blood cell compatibility. Plasma and platelet compatibility follow different rules (e.g., AB plasma is the universal plasma donor type), and final matching always requires crossmatching by clinical staff.',
      { exact: true },
    ),
  ).toBeVisible();
});

test('journey stages are keyboard operable and announce the selection', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');

  const stage = page.getByRole('button', { name: 'Show Reserve stage' });
  await stage.focus();
  await page.keyboard.press('Enter');
  await expect(stage).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.journey-vessel__selection')).toContainText('Reserve');
});

test('forced colors keeps the primary call to action visible', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await page.goto('/');
  const action = page.getByRole('link', { name: /Become a donor/i }).first();
  await expect(action).toBeVisible();
  await action.focus();
  await expect(action).toBeFocused();
});

test('reduced motion removes decorative animation without hiding content', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  await expect(page.locator('.lifeline-path__trace').first()).toHaveCSS('animation-name', 'none');
  await expect(page.locator('.cell-field__cell').first()).toHaveCSS('animation-name', 'none');
  await expect(page.locator('.reveal').first()).toHaveCSS('opacity', '1');
  await expect(
    page.getByText(
      'Nearby donor discovery is an operational assistance feature. Final donor eligibility, blood compatibility and clinical decisions require authorized clinical verification.',
      { exact: true },
    ),
  ).toBeVisible();
});

test('developer-only design kit renders in the dev server', async ({ page }) => {
  await page.goto('/__kit');
  await expect(page.getByRole('heading', { level: 1, name: 'The Lifeline design kit' })).toBeVisible();
});
