const { chromium } = require('C:/Users/karka/Advanced-Object-Oriented-Programming-Project/project/frontend/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');

const BASE = 'http://127.0.0.1:15173';
const OUT = 'C:/Users/karka/AppData/Local/Temp/opencode/lifelink-evidence';
const APP_ROUTES = [
  'dashboard', 'inventory', 'donors', 'donations', 'requests', 'allocations',
  'reservations', 'dispatch', 'notifications', 'audit', 'analytics',
  'admin/users', 'admin/organizations', 'profile',
];

const results = [];

async function inspectPage(page, label) {
  const info = await page.evaluate(() => ({
    title: document.title,
    h1: document.querySelector('h1')?.textContent?.trim() ?? null,
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    visibleText: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 400),
  }));
  results.push({ label, ...info });
  return info;
}

async function capturePage(browser, viewport, label, authenticated) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [];
  const failed = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('response', (res) => { if (res.status() >= 500) failed.push(`${res.status()} ${res.url()}`); });

  if (authenticated) {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    await page.locator('input[type="email"]').fill('bank@lifelink.local');
    await page.locator('input[type="password"]').fill('Bank@123!');
    await page.getByRole('button', { name: /^Sign in$/ }).click();
    await page.waitForURL(/\/app\/dashboard/, { timeout: 20000 });
  } else {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  }
  await page.waitForTimeout(900);
  await inspectPage(page, `${label}:entry`);

  const routes = authenticated ? APP_ROUTES : [];
  for (const route of routes) {
    await page.goto(`${BASE}/app/${route}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(550);
    await inspectPage(page, `${label}:${route}`);
    if (viewport.width === 1440 && ['dashboard', 'inventory', 'requests'].includes(route)) {
      await page.screenshot({ path: path.join(OUT, `before-${route}-${label}.png`), fullPage: true });
    }
  }
  results.push({ label: `${label}:summary`, consoleErrors: errors, serverErrors: failed });
  await context.close();
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const viewports = [
    { name: 'desktop1440', width: 1440, height: 900 },
    { name: 'tablet1024', width: 1024, height: 768 },
    { name: 'tablet768', width: 768, height: 1024 },
    { name: 'mobile390', width: 390, height: 844 },
    { name: 'mobile360', width: 360, height: 800 },
  ];
  try {
    for (const vp of viewports) {
      const { name, ...viewport } = vp;
      await capturePage(browser, viewport, `landing-${name}`, false);
    }
    for (const vp of [viewports[0], viewports[3]]) {
      const { name, ...viewport } = vp;
      await capturePage(browser, viewport, `app-${name}`, true);
    }
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(OUT, 'baseline_browser_audit.json'), JSON.stringify(results, null, 2));
  const overflowing = results.filter((r) => r.overflow);
  const errors = results.filter((r) => r.consoleErrors?.length || r.serverErrors?.length);
  console.log(JSON.stringify({
    pagesInspected: results.filter((r) => r.scrollWidth !== undefined).length,
    overflowing: overflowing.map((r) => r.label),
    errorSummaries: errors,
  }, null, 2));
})().catch((error) => { console.error(error); process.exit(1); });
