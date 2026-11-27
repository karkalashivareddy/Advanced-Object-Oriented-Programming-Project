import { expect, test, type Page } from '@playwright/test';

const ADMIN = { email: 'admin@lifelink.local', password: 'Admin@123!' };

async function login(page: Page, credentials = ADMIN) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(credentials.email);
  await page.locator('input[type="password"]').fill(credentials.password);
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
  const forbiddenPaths: string[] = [];
  page.on('response', (response) => {
    if (response.status() === 403) forbiddenPaths.push(new URL(response.url()).pathname);
  });

  await login(page);
  const operationalMetrics = page.locator('.operational-metrics').last();
  await expect(operationalMetrics.locator('.metric-card')).toHaveCount(6);
  await expect.poll(() => operationalMetrics.evaluate((element) =>
    getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(3);

  await page.getByRole('navigation', { name: 'Sections' })
    .getByRole('link', { name: 'Emergency requests' }).click();
  await expect(page.getByLabel('Request status')).toBeVisible();

  const filtered = page.waitForRequest((request) =>
    request.url().includes('/api/v1/emergency-requests') && request.url().includes('status=APPROVED'));
  await page.getByLabel('Request status').selectOption('APPROVED');
  await filtered;
  await expect(page.getByLabel('Request status')).toHaveValue('APPROVED');
  expect(forbiddenPaths).toEqual([]);
});

test('donor search and blood-group filters use bounded server-side pages', async ({ page }) => {
  await login(page);
  await page.getByRole('navigation', { name: 'Sections' })
    .getByRole('link', { name: 'Donors' }).click();
  await expect(page.getByLabel('Search donors')).toBeVisible();

  const searchRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname.endsWith('/api/v1/donors') &&
      url.searchParams.get('search') === 'NoSuchDemoDonor' &&
      url.searchParams.get('page') === '0' &&
      url.searchParams.get('size') === '10';
  });
  await page.getByLabel('Search donors').fill('NoSuchDemoDonor');
  await searchRequest;

  const groupRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname.endsWith('/api/v1/donors') &&
      url.searchParams.get('search') === 'NoSuchDemoDonor' &&
      url.searchParams.get('bloodGroup') === 'O_POSITIVE';
  });
  await page.getByLabel('Blood group').selectOption('O_POSITIVE');
  await groupRequest;
});

test('donations workspace consumes the paged donor options response', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await login(page, { email: 'bank@lifelink.local', password: 'Bank@123!' });
  await page.getByRole('navigation', { name: 'Sections' })
    .getByRole('link', { name: 'Donations' }).click();
  await expect(page.getByRole('heading', { name: 'Donations' })).toBeVisible();
  await expect(page.getByLabel('Donor')).toBeVisible();
  await expect(page.getByText('Donor options unavailable')).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test('donor dashboard consumes the paged donor profile response', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await login(page, { email: 'donor@lifelink.local', password: 'Donor@123!' });
  await expect(page.getByRole('heading', { name: 'Your donor workspace' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Upcoming appointments', exact: true })).toBeVisible();
  expect(pageErrors).toEqual([]);
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

test('analytics has no horizontal page overflow on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);

  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  const dialog = page.getByRole('dialog', { name: 'Navigation menu' });
  await dialog.getByRole('link', { name: 'Analytics' }).click();
  await expect(page).toHaveURL(/\/app\/analytics/);
  await expect(page.getByRole('heading', { name: /Analytics/i }).first()).toBeVisible();
  await expect(page.locator('.sidebar')).toHaveCSS('transform', /matrix\(1, 0, 0, 1, -?\d+/);
  await page.waitForTimeout(350);

  const widths = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    bodyWidth: document.body.scrollWidth,
  }));
  expect(widths.documentWidth).toBeLessThanOrEqual(widths.viewportWidth);
  expect(widths.bodyWidth).toBeLessThanOrEqual(widths.viewportWidth);
});

test('nearby search and emergency requests have no desktop horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, { email: 'bank@lifelink.local', password: 'Bank@123!' });
  for (const [label, href] of [
    ['Nearby donor finder', '/app/donors/nearby'],
    ['Emergency requests', '/app/requests'],
  ]) {
    await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: label }).click();
    await expect(page).toHaveURL(new RegExp(href.replaceAll('/', '\\/')));
    const widths = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    }));
    expect(widths.documentWidth).toBeLessThanOrEqual(widths.viewportWidth);
  }
});

test('browser opens an authenticated STOMP subscription while REST polling remains active', async ({ page }) => {
  const sentFrames: string[] = [];
  const restPolls: string[] = [];

  page.on('websocket', (socket) => {
    if (socket.url().includes('/ws/')) {
      socket.on('framesent', (frame) => sentFrames.push(String(frame.payload)));
    }
  });
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/notifications/unread-count')) restPolls.push(request.url());
  });

  await login(page);

  await expect.poll(
    () => sentFrames.some((frame) => frame.includes('CONNECT') && frame.includes('Bearer ')),
    { timeout: 15_000 },
  ).toBe(true);
  await expect.poll(
    () => sentFrames.some((frame) =>
      frame.includes('SUBSCRIBE') && frame.includes('/user/queue/notifications')),
    { timeout: 15_000 },
  ).toBe(true);
  expect(restPolls.length).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: /Notifications/ })).toBeVisible();
});
