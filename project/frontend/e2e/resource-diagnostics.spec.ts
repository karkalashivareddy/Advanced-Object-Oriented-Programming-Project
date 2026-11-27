import { expect, test } from '@playwright/test';

test('records failed browser resources and unload listeners with their initiators', async ({ page }, testInfo) => {
  const cdp = await page.context().newCDPSession(page);
  const requests = new Map<string, Record<string, unknown>>();
  const failures: Record<string, unknown>[] = [];
  const policyMessages: Record<string, unknown>[] = [];
  const consoleMessages: string[] = [];

  await cdp.send('Network.enable');
  await cdp.send('Log.enable');
  cdp.on('Network.requestWillBeSent', (event) => {
    requests.set(event.requestId, {
      url: event.request.url,
      method: event.request.method,
      type: event.type,
      initiator: event.initiator,
      frameId: event.frameId,
    });
  });
  cdp.on('Network.responseReceived', (event) => {
    if (event.response.status >= 400) {
      failures.push({
        request: requests.get(event.requestId),
        status: event.response.status,
        statusText: event.response.statusText,
        mimeType: event.response.mimeType,
        fromDiskCache: event.response.fromDiskCache,
      });
    }
  });
  cdp.on('Log.entryAdded', ({ entry }) => {
    if (/unload/i.test(entry.text)) {
      policyMessages.push({ source: entry.source, url: entry.url, lineNumber: entry.lineNumber, text: entry.text });
    }
  });
  page.on('console', (message) => {
    if (message.type() === 'error' || /unload/i.test(message.text())) consoleMessages.push(message.text());
  });
  await page.addInitScript(() => {
    const diagnostic = { registrations: [] as Array<{ type: string; stack?: string }>, propertyWrites: [] as string[] };
    Object.defineProperty(window, '__lifelinkUnloadDiagnostic', { value: diagnostic });
    const add = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function(type, listener, options) {
      if (type === 'unload' || type === 'beforeunload') {
        diagnostic.registrations.push({ type, stack: new Error().stack });
      }
      return add.call(this, type, listener, options);
    };
    for (const property of ['onunload', 'onbeforeunload'] as const) {
      let current = window[property];
      Object.defineProperty(window, property, {
        configurable: true,
        get: () => current,
        set: (value) => {
          diagnostic.propertyWrites.push(property);
          current = value;
        },
      });
    }
  });

  for (const path of ['/', '/register', '/login']) {
    await page.goto(path);
    await expect(page.locator('h1').first()).toBeVisible();
  }
  const unloadListeners = await page.evaluate(() =>
    (window as Window & { __lifelinkUnloadDiagnostic?: { registrations: unknown[]; propertyWrites: string[] } })
      .__lifelinkUnloadDiagnostic ?? null,
  );
  await testInfo.attach('browser-resource-diagnostics', {
    body: JSON.stringify({
      generatedAt: new Date().toISOString(),
      browser: testInfo.project.name,
      routes: ['/', '/register', '/login'],
      failedResponses: failures,
      unloadListeners,
      unloadPolicyMessages: policyMessages,
      relevantConsoleMessages: consoleMessages,
    }, null, 2),
    contentType: 'application/json',
  });
  expect(failures).toEqual([]);
});
