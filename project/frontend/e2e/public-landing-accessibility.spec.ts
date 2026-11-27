import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test('redesigned landing page has no axe WCAG A/AA violations', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const result = await new AxeBuilder({ page }).withTags(wcagTags).analyze();
  await testInfo.attach('axe-landing', {
    body: JSON.stringify({
      generatedAt: new Date().toISOString(),
      route: '/',
      browser: testInfo.project.name,
      tags: wcagTags,
      violations: result.violations,
      passes: result.passes.length,
      incomplete: result.incomplete.map(({ id, impact, description }) => ({ id, impact, description })),
    }, null, 2),
    contentType: 'application/json',
  });
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
});
