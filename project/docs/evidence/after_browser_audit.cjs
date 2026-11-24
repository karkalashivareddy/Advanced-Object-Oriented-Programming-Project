const { chromium } = require('C:/Users/karka/Advanced-Object-Oriented-Programming-Project/project/frontend/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');

const BASE = process.env.AUDIT_BASE_URL ?? 'http://127.0.0.1:4174';
const EVIDENCE_DIR = __dirname;
const SCREENSHOTS = path.join(EVIDENCE_DIR, 'screenshots');
const ADMIN = { email: 'admin@lifelink.local', password: 'Admin@123!' };

fs.mkdirSync(SCREENSHOTS, { recursive: true });

async function inspect(page, label) {
  return page.evaluate((name) => {
    const root = getComputedStyle(document.documentElement);
    const visual = document.querySelector('.bloodstream-visual');
    const visualStyle = visual ? getComputedStyle(visual) : null;
    const flow = document.querySelector('.bloodstream-visual__flow');
    const flowStyle = flow ? getComputedStyle(flow) : null;
    const tableWrap = document.querySelector('.chart-data-table-wrap');
    const wrapStyle = tableWrap ? getComputedStyle(tableWrap) : null;
    return {
      label: name,
      url: location.pathname,
      title: document.title,
      h1: document.querySelector('h1')?.textContent?.trim() ?? null,
      viewportWidth: document.documentElement.clientWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      bloodstreamTokens: {
        vessel900: root.getPropertyValue('--color-vessel-900').trim(),
        vessel500: root.getPropertyValue('--color-vessel-500').trim(),
        motionPulse: root.getPropertyValue('--motion-pulse').trim(),
      },
      bloodstreamVisualPresent: Boolean(visual),
      cssFlowAnimation: flowStyle?.animationName ?? null,
      smilAnimateMotionCount: document.querySelectorAll('animateMotion').length,
      chartTableWrapPresent: Boolean(tableWrap),
      chartTableWrapOverflowX: wrapStyle?.overflowX ?? null,
      chartTableCount: document.querySelectorAll('.chart-data-table').length,
      prefersReducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    };
  }, label);
}

async function landingAudit(browser, viewport, label, reducedMotion) {
  const context = await browser.newContext({ viewport, reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  const result = await inspect(page, label);
  await page.screenshot({ path: path.join(SCREENSHOTS, `landing-after-${label}.png`), fullPage: true });
  await context.close();
  return result;
}

async function analyticsAudit(browser, viewport, label, stompCapture) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [];
  const serverErrors = [];
  const restPolls = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('response', (res) => {
    if (res.status() >= 500) serverErrors.push(`${res.status()} ${res.url()}`);
    if (res.url().includes('/api/v1/notifications/unread-count')) restPolls.push(res.url());
  });
  if (stompCapture) {
    page.on('websocket', (socket) => {
      if (!socket.url().includes('/ws/')) return;
      stompCapture.websocketUrls.push(socket.url().replace(/\/ws\/\d+\/[^/]+\/websocket$/, '/ws/{server}/{session}/websocket'));
      socket.on('framesent', (frame) => stompCapture.sentFrames.push(String(frame.payload)));
      socket.on('framereceived', (frame) => stompCapture.receivedFrames.push(String(frame.payload)));
      socket.on('close', () => stompCapture.closedSockets += 1);
    });
  }

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email address').fill(ADMIN.email);
  await page.locator('input[type="password"]').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/app\/dashboard/, { timeout: 20_000 });
  await page.goto(`${BASE}/app/analytics`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1_200);
  const result = await inspect(page, label);
  await page.screenshot({ path: path.join(SCREENSHOTS, `analytics-after-${label}.png`), fullPage: true });
  await context.close();
  return { ...result, consoleErrors: errors, serverErrors, notificationPolls: restPolls.length };
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const stompCapture = { websocketUrls: [], sentFrames: [], receivedFrames: [], closedSockets: 0 };
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE,
    note: 'Browser run against the local Vite dev-server proxy to the live Compose backend; no containers or database were recreated.',
    pages: [],
  };
  try {
    report.pages.push(await landingAudit(browser, { width: 1440, height: 900 }, 'desktop', false));
    report.pages.push(await landingAudit(browser, { width: 390, height: 844 }, 'mobile', false));
    report.pages.push(await landingAudit(browser, { width: 1440, height: 900 }, 'reduced-motion', true));
    report.pages.push(await analyticsAudit(browser, { width: 1440, height: 900 }, 'desktop', stompCapture));
    report.pages.push(await analyticsAudit(browser, { width: 390, height: 844 }, 'mobile', null));
  } finally {
    await browser.close();
  }

  fs.writeFileSync(path.join(EVIDENCE_DIR, 'AFTER_BROWSER_AUDIT.json'), JSON.stringify(report, null, 2));

  const sent = stompCapture.sentFrames.join('\n');
  const received = stompCapture.receivedFrames.join('\n');
  const stomp = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE,
    authenticatedUser: ADMIN.email,
    observed: {
      websocketUrls: stompCapture.websocketUrls,
      connectFrameWithBearerToken: /CONNECT[\s\S]*Authorization:Bearer\s+\S+/.test(sent),
      subscribeDestination: sent.match(/destination:(\/user\/queue\/notifications)/)?.[1] ?? null,
      connectedFrameReceived: received.includes('CONNECTED'),
      notificationRestPollRequests: report.pages.find((p) => p.label === 'analytics:desktop')?.notificationPolls ?? 0,
      closedSockets: stompCapture.closedSockets,
    },
    note: 'JWT values are deliberately omitted; booleans and destinations are derived from the captured frames.',
  };
  fs.writeFileSync(path.join(EVIDENCE_DIR, 'BROWSER_STOMP_RESULT.json'), JSON.stringify(stomp, null, 2));

  console.log(JSON.stringify({
    pages: report.pages.map((p) => ({
      label: p.label,
      overflow: p.horizontalOverflow,
      documentScrollWidth: p.documentScrollWidth,
      viewportWidth: p.viewportWidth,
      visual: p.bloodstreamVisualPresent,
      smil: p.smilAnimateMotionCount,
      tableWrap: p.chartTableWrapPresent,
    })),
    stomp: stomp.observed,
  }, null, 2));
})().catch((error) => { console.error(error); process.exit(1); });
