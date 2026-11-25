/*
 * Final browser evidence harness for the LifeLink deep-engineering audit.
 *
 * This is a custom Playwright evidence collector, not Lighthouse or a full axe audit.
 * It records DOM overflow, console/page errors, HTTP failures, basic accessible-name
 * coverage, reduced-motion behaviour, navigation timing, and real screenshots.
 *
 * Usage:
 *   node project/docs/evidence/final_browser_audit.cjs
 * Optional:
 *   APP_URL=http://127.0.0.1:15174/ node project/docs/evidence/final_browser_audit.cjs
 *
 * Credentials are read from environment variables and are never written to evidence.
 */
const { chromium } = require('C:/Users/karka/Advanced-Object-Oriented-Programming-Project/project/frontend/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');

const BASE = (process.env.APP_URL || 'http://127.0.0.1:15174').replace(/\/$/, '');
const EMAIL = process.env.LIFELINK_DEMO_EMAIL || 'bank@lifelink.local';
const PASSWORD = process.env.LIFELINK_DEMO_PASSWORD || 'Bank@123!';
const EVIDENCE_DIR = __dirname;
const SHOT_DIR = path.join(EVIDENCE_DIR, 'screenshots');

const VIEWPORTS = [
  { name: 'desktop1440', width: 1440, height: 900 },
  { name: 'tablet768', width: 768, height: 1024 },
  { name: 'mobile390', width: 390, height: 844 },
];

const PUBLIC_ROUTES = [
  { path: '/', name: 'landing', expectH1: /LifeLink|Blood|donor|network/i },
  { path: '/login', name: 'login', expectH1: /Welcome back/i },
  { path: '/register', name: 'register', expectH1: /Create|Register|Join/i },
  { path: '/not-found-route', name: 'not_found', expectH1: /404|not found|page/i },
];

const APP_ROUTES = [
  { path: '/app/dashboard', name: 'dashboard' },
  { path: '/app/inventory', name: 'inventory' },
  { path: '/app/donors', name: 'donors' },
  { path: '/app/donors/nearby', name: 'donors_nearby', optional: true },
  { path: '/app/donations', name: 'donations' },
  { path: '/app/requests', name: 'requests' },
  { path: '/app/allocations', name: 'allocations' },
  { path: '/app/reservations', name: 'reservations' },
  { path: '/app/dispatch', name: 'dispatch' },
  { path: '/app/notifications', name: 'notifications' },
  { path: '/app/audit', name: 'audit' },
  { path: '/app/analytics', name: 'analytics' },
  { path: '/app/admin/users', name: 'admin_users' },
  { path: '/app/admin/organizations', name: 'admin_organizations' },
  { path: '/app/profile', name: 'profile' },
];

const pages = [];
const accessibility = [];
const performance = [];
const consoleErrors = [];
const failedResponses = [];

fs.mkdirSync(SHOT_DIR, { recursive: true });

function slug(value) {
  return value.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toLowerCase();
}

function recordIssue(kind, detail) {
  if (kind === 'console') consoleErrors.push(detail);
  if (kind === 'response') failedResponses.push(detail);
}

async function waitForReady(page, expectH1) {
  await page.waitForFunction(
    (pattern) => {
      const h1 = document.querySelector('h1');
      const body = document.body?.innerText || '';
      const patternOk = !pattern || new RegExp(pattern, 'i').test(h1?.textContent || '');
      return Boolean(h1 && patternOk && !body.includes('Loading content'));
    },
    expectH1 ? String(expectH1.source || expectH1) : null,
    { timeout: 20000 },
  ).catch(() => undefined);
  await page.waitForTimeout(350);
}

async function inspect(page, label, route, viewport, expectH1, screenshot) {
  const dom = await page.evaluate(() => {
    const de = document.documentElement;
    const visible = (el) => {
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && el.getClientRects().length > 0;
    };
    const nameOf = (el) => {
      const aria = el.getAttribute('aria-label');
      if (aria && aria.trim()) return aria.trim();
      const labelledBy = el.getAttribute('aria-labelledby');
      if (labelledBy) {
        const text = labelledBy.split(/\s+/).map((id) => document.getElementById(id)?.textContent?.trim() || '').join(' ').trim();
        if (text) return text;
      }
      if (el.labels && el.labels.length) {
        const text = Array.from(el.labels).map((l) => l.textContent?.trim() || '').join(' ').trim();
        if (text) return text;
      }
      const text = (el.innerText || el.textContent || '').trim();
      if (text) return text;
      if (el.matches('input,textarea,select')) {
        const placeholder = el.getAttribute('placeholder');
        if (placeholder && placeholder.trim()) return placeholder.trim();
      }
      return '';
    };
    const interactive = Array.from(document.querySelectorAll('a[href],button,input,select,textarea,[role="button"]'))
      .filter(visible)
      .map((el, index) => {
        const name = nameOf(el);
        return name ? null : { index, tag: el.tagName.toLowerCase(), type: el.getAttribute('type') || '', cls: (el.className || '').toString().slice(0, 80) };
      })
      .filter(Boolean);
    const images = Array.from(document.querySelectorAll('img')).filter(visible).filter((img) => !img.hasAttribute('alt'))
      .map((img) => (img.getAttribute('src') || '').slice(0, 120));
    const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).filter(visible)
      .map((h) => Number(h.tagName.slice(1)));
    const firstInteractive = Array.from(document.querySelectorAll('a[href],button,input,select,textarea,[role="button"]')).find(visible);
    let focus = null;
    if (firstInteractive) {
      firstInteractive.focus();
      const style = window.getComputedStyle(firstInteractive);
      focus = {
        activeElement: document.activeElement === firstInteractive,
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        boxShadow: style.boxShadow === 'none' ? 'none' : 'present',
      };
      firstInteractive.blur();
    }
    const resources = performance.getEntriesByType('resource').filter((r) => r.name.includes('/api/v1/'));
    const api = resources.map((r) => ({
      name: r.name.replace(location.origin, ''),
      durationMs: Math.round(r.duration),
      transferSize: r.transferSize || 0,
      decodedBodySize: r.decodedBodySize || 0,
    }));
    return {
      url: location.href,
      title: document.title,
      h1: document.querySelector('h1')?.textContent?.trim() ?? null,
      lang: document.documentElement.lang || null,
      scrollWidth: de.scrollWidth,
      clientWidth: de.clientWidth,
      innerWidth: window.innerWidth,
      overflow: de.scrollWidth > window.innerWidth + 1,
      bodyText: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 260),
      h1Count: document.querySelectorAll('h1').length,
      unnamedInteractive: interactive,
      imagesWithoutAlt: images,
      headingOrder: headings,
      focus,
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      apiResources: api,
      navigation: {
        domContentLoadedMs: Math.round(performance.domContentLoadedEventEnd),
        loadMs: Math.round(performance.loadEventEnd),
        responseEndMs: Math.round(performance.getEntriesByType('navigation')[0]?.responseEnd || 0),
      },
    };
  });

  const expected = expectH1 ? expectH1.test(dom.h1 || '') : Boolean(dom.h1);
  const pageResult = {
    label,
    route,
    viewport,
    url: dom.url,
    title: dom.title,
    h1: dom.h1,
    expectedH1: expected,
    overflow: dom.overflow,
    scrollWidth: dom.scrollWidth,
    innerWidth: dom.innerWidth,
    bodyText: dom.bodyText,
    screenshot: screenshot ? path.relative(EVIDENCE_DIR, screenshot).replace(/\\/g, '/') : null,
  };
  pages.push(pageResult);

  accessibility.push({
    label,
    route,
    viewport,
    lang: dom.lang,
    h1Count: dom.h1Count,
    expectedH1: expected,
    unnamedInteractiveCount: dom.unnamedInteractive.length,
    unnamedInteractive: dom.unnamedInteractive.slice(0, 12),
    imagesWithoutAlt: dom.imagesWithoutAlt.slice(0, 12),
    headingOrder: dom.headingOrder.slice(0, 30),
    firstInteractiveFocus: dom.focus,
    reducedMotion: dom.reducedMotion,
    note: 'Custom DOM-level checks; not a full axe-core or screen-reader audit.',
  });

  performance.push({
    label,
    route,
    viewport,
    navigation: dom.navigation,
    apiRequests: dom.apiResources.length,
    slowestApiRequests: dom.apiResources.sort((a, b) => b.durationMs - a.durationMs).slice(0, 5),
    note: 'Browser PerformanceTiming/resource timings only; not Lighthouse or field Web Vitals.',
  });

  return dom;
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole('button', { name: /^Sign in$/ }).click();
  await page.waitForURL(/\/app\/dashboard/, { timeout: 25000 });
  await waitForReady(page, /Good to see you|Workspace|dashboard/i);
}

async function runViewport(browser, vp, reducedMotion) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    reducedMotion: reducedMotion ? 'reduce' : 'no-preference',
  });
  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') recordIssue('console', `${vp.name}${reducedMotion ? ':reduced' : ''} ${msg.text().slice(0, 240)}`);
  });
  page.on('pageerror', (err) => recordIssue('console', `${vp.name}${reducedMotion ? ':reduced' : ''} ${String(err).slice(0, 240)}`));
  page.on('response', (res) => {
    if (res.status() >= 400) recordIssue('response', `${vp.name}${reducedMotion ? ':reduced' : ''} ${res.status()} ${res.url()}`);
  });

  const routes = reducedMotion
    ? [{ path: '/', name: 'landing_reduced', expectH1: /LifeLink|Blood|donor|network/i }, { path: '/app/dashboard', name: 'dashboard_reduced' }]
    : [...PUBLIC_ROUTES, ...APP_ROUTES];

  let authenticated = false;
  for (const route of routes) {
    const isApp = route.path.startsWith('/app/');
    if (isApp && !authenticated) {
      await login(page);
      authenticated = true;
    }
    const label = `${route.name}_${vp.name}${reducedMotion ? '_reduced' : ''}`;
    await page.goto(`${BASE}${route.path}`, { waitUntil: 'domcontentloaded' });
    await waitForReady(page, route.expectH1);
    const shot = path.join(SHOT_DIR, `final_${slug(label)}.png`);
    const dom = await inspect(page, label, route.path, vp.name, route.expectH1, shot);
    await page.screenshot({ path: shot, fullPage: true });
    if (route.optional && dom.url.endsWith('/not-found-route')) {
      pages[pages.length - 1].optionalRouteMissing = true;
    }
  }
  await context.close();
}

function bundleSizes() {
  const dist = path.resolve(EVIDENCE_DIR, '../../frontend/dist/assets');
  if (!fs.existsSync(dist)) return { available: false, reason: 'frontend/dist/assets not present when evidence was generated' };
  const files = fs.readdirSync(dist).map((file) => {
    const stat = fs.statSync(path.join(dist, file));
    return { file, bytes: stat.size };
  });
  return {
    available: true,
    files,
    totalBytes: files.reduce((sum, f) => sum + f.bytes, 0),
    note: 'Static asset sizes from the production build directory.',
  };
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const vp of VIEWPORTS) await runViewport(browser, vp, false);
    for (const vp of [VIEWPORTS[0], VIEWPORTS[2]]) await runViewport(browser, vp, true);
  } finally {
    await browser.close();
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE,
    pagesInspected: pages.length,
    overflowing: pages.filter((p) => p.overflow).map((p) => p.label),
    missingExpectedH1: pages.filter((p) => !p.expectedH1 && !p.optionalRouteMissing).map((p) => p.label),
    optionalRoutesMissing: pages.filter((p) => p.optionalRouteMissing).map((p) => p.route),
    consoleErrors,
    failedResponses,
    screenshotDirectory: 'screenshots',
  };
  fs.writeFileSync(path.join(EVIDENCE_DIR, 'FINAL_BROWSER_AUDIT.json'), JSON.stringify({ summary, pages }, null, 2));
  fs.writeFileSync(path.join(EVIDENCE_DIR, 'ACCESSIBILITY_EVIDENCE.json'), JSON.stringify({
    generatedAt: summary.generatedAt,
    method: 'Custom DOM-level Playwright checks on real rendered routes',
    scope: 'lang, single H1, expected H1, accessible names for visible interactives, img alt, heading order, initial focus visibility, reduced-motion',
    limitations: 'Not a full axe-core audit, not a screen-reader session, and not a formal WCAG conformance claim.',
    records: accessibility,
  }, null, 2));
  fs.writeFileSync(path.join(EVIDENCE_DIR, 'PERFORMANCE_EVIDENCE.json'), JSON.stringify({
    generatedAt: summary.generatedAt,
    method: 'Browser PerformanceTiming and resource timing samples from real routes',
    scope: 'DOMContentLoaded, load, responseEnd, API request counts and slowest API requests, production asset sizes',
    limitations: 'Not Lighthouse, not field Web Vitals, no throttling, samples vary by machine and network.',
    bundles: bundleSizes(),
    records: performance,
  }, null, 2));
  console.log(JSON.stringify(summary, null, 2));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
