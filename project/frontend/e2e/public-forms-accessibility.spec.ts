import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

for (const route of [
  { path: '/register', name: 'registration' },
  { path: '/login', name: 'login' },
]) {
  test(`${route.name} public form has no axe WCAG A/AA violations`, async ({ page }, testInfo) => {
    await page.goto(route.path);
    await expect(page.locator('form')).toBeVisible();
    const result = await new AxeBuilder({ page }).withTags(wcagTags).analyze();
    await testInfo.attach(`axe-${route.name}`, {
      body: JSON.stringify({
        generatedAt: new Date().toISOString(),
        route: route.path,
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
}
