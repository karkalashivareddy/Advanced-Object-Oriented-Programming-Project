// Repeatable UI quality audit. Uses the installed Chrome channel and writes
// untracked evidence to frontend/ui-audit/. Run: node scripts/ui-audit.mjs
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = path.join(ROOT, 'ui-audit');
const BASE_URL = process.env.UI_AUDIT_BASE_URL ?? 'http://127.0.0.1:5173';
const EMAIL = process.env.UI_AUDIT_EMAIL ?? 'admin@lifelink.local';
const PASSWORD = process.env.UI_AUDIT_PASSWORD ?? 'Admin@123!';
const VIEWPORTS = [
  { label: '1366x657', width: 1366, height: 657 },
  { label: '1440x700', width: 1440, height: 700 },
  { label: '1920x950', width: 1920, height: 950 },
  { label: '768x1024', width: 768, height: 1024 },
  { label: '390x844', width: 390, height: 844 },
];
const PUBLIC_ROUTES = ['/', '/login', '/register'];
const AUTH_ROUTES = [
  '/app/dashboard', '/app/inventory', '/app/donors',
  '/app/donors/nearby', '/app/requests', '/app/analytics',
];
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const HERO_VIEWPORTS = new Set(['1366x657', '1440x700']);
const ROOT_COPY = Object.freeze({
  heading: 'Every Drop Has a Destination.',
  lede: 'Connecting donors, hospitals and blood banks through one intelligent lifeline. Because when every second matters, every connection counts.',
  ctas: ['Find Blood', 'Become a Donor'],
});
const SECTIONS_NAV_NAME = 'Sections';

const message = (error) => (error instanceof Error ? error.message : String(error));
const check = (name, status, details = {}) => ({ name, status, ...details });
const slugFor = (route) => (route === '/' ? 'root' : route.replace(/^\/+|\/+$/g, '').replaceAll('/', '-'));
const routeUrl = (route) => new URL(route, BASE_URL).href;
const evidenceFile = (slug, suffix) => `ui-audit/${slug}-${suffix}.png`;

function statusOf(checks) {
  if (checks.some((item) => item.status === 'error')) return 'error';
  if (checks.some((item) => item.status === 'warning')) return 'warning';
  return checks.every((item) => item.status === 'skip') ? 'skip' : 'pass';
}

async function guard(name, fn) {
  try { return await fn(); } catch (error) { return check(name, 'error', { message: message(error) }); }
}

function installDiagnostics(page) {
  const data = { consoleErrors: [], consoleWarnings: [], pageErrors: [], failedResponses: [], requestFailures: [] };
  const handlers = {
    console: (item) => {
      const type = item.type();
      if (!['error', 'warning', 'warn'].includes(type)) return;
      const entry = { type, text: item.text(), location: item.location() };
      (type === 'error' ? data.consoleErrors : data.consoleWarnings).push(entry);
    },
    pageerror: (error) => data.pageErrors.push({ message: message(error) }),
    response: (response) => {
      if (response.status() >= 400) data.failedResponses.push({ status: response.status(), url: response.url() });
    },
    requestfailed: (request) => data.requestFailures.push({ url: request.url(), failure: request.failure()?.errorText ?? 'unknown' }),
  };
  for (const [event, handler] of Object.entries(handlers)) page.on(event, handler);
  return { data, detach: () => { for (const [event, handler] of Object.entries(handlers)) page.off(event, handler); } };
}

async function installClsObserver(page) {
  await page.addInitScript(() => {
    window.__uiAuditShifts = [];
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.hadRecentInput) continue;
          const sources = Array.isArray(entry.sources)
            ? entry.sources.slice(0, 4).map((source) => ({
                tag: source.node?.tagName?.toLowerCase() ?? 'unknown',
                className: String(source.node?.className ?? '').slice(0, 120),
              }))
            : [];
          window.__uiAuditShifts.push({ value: entry.value, startTime: entry.startTime, sources });
        }
      }).observe({ type: 'layout-shift', buffered: true });
    } catch (error) { window.__uiAuditShiftError = String(error); }
  });
}

async function navigate(page, route) {
  await page.goto(routeUrl(route), { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForLoadState('load', { timeout: 20_000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 1_500 }).catch(() => {});
  await page.waitForTimeout(450);
}

function overflowCheck(page) {
  return guard('horizontalOverflow', async () => {
    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    const overflow = metrics.scrollWidth > metrics.innerWidth + 1;
    return check('horizontalOverflow', overflow ? 'error' : 'pass', metrics);
  });
}

function childOverflowCheck(page) {
  return guard('childOverflow', async () => {
    const result = await page.evaluate(() => {
      const findings = [];
      const describe = (node) => ({
        tag: node.tagName?.toLowerCase() ?? 'unknown',
        className: (node.getAttribute?.('class') ?? '').slice(0, 120),
        text: (node.textContent ?? '').trim().slice(0, 60),
      });
      const isSvgNode = (node) =>
        node instanceof SVGElement || node.namespaceURI === 'http://www.w3.org/2000/svg' ||
        node.tagName?.toLowerCase() === 'svg';
      // Walk every ancestor: SVG internals are clipped by their own viewBox,
      // and aria-hidden/presentation/fixed subtrees are intentionally outside
      // the normal document flow. closest() alone is not sufficient here.
      const isExcluded = (element) => {
        for (let node = element; node && node !== document.documentElement; node = node.parentElement) {
          if (isSvgNode(node) || (typeof node.closest === 'function' && node.closest('svg') !== null)) return true;
          if (node.getAttribute?.('aria-hidden') === 'true' || node.getAttribute?.('role') === 'presentation') return true;
          let position;
          try { position = getComputedStyle(node).position; } catch { continue; }
          if (position === 'fixed') return true;
        }
        return false;
      };
      for (const element of document.querySelectorAll('body *')) {
        if (isExcluded(element)) continue;
        const style = getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
        const negative = parseFloat(style.width) < 0 || parseFloat(style.height) < 0;
        const rect = element.getBoundingClientRect();
        let clipped = null;
        if (rect.width > 0 && rect.height > 0) {
          for (let ancestor = element.parentElement; ancestor && ancestor !== document.documentElement; ancestor = ancestor.parentElement) {
            if (isSvgNode(ancestor)) break;
            const parentStyle = getComputedStyle(ancestor);
            if (parentStyle.display === 'none' || parentStyle.visibility === 'hidden') break;
            // A genuinely scrollable overflow container is an intentional
            // affordance (sidebar rail, wide matrix), not a clipped child.
            const scrollable = /auto|scroll|overlay/.test(`${parentStyle.overflowX} ${parentStyle.overflowY}`) &&
              (ancestor.scrollHeight > ancestor.clientHeight + 2 || ancestor.scrollWidth > ancestor.clientWidth + 2);
            if (scrollable) break;
            const parentRect = ancestor.getBoundingClientRect();
            const beyondX = parentStyle.overflowX !== 'visible' && (rect.left < parentRect.left - 2 || rect.right > parentRect.right + 2);
            const beyondY = parentStyle.overflowY !== 'visible' && (rect.top < parentRect.top - 2 || rect.bottom > parentRect.bottom + 2);
            if (beyondX || beyondY) {
              clipped = {
                axis: [beyondX ? 'x' : null, beyondY ? 'y' : null].filter(Boolean).join('+'),
                ancestor: describe(ancestor),
                overflowX: parentStyle.overflowX,
                overflowY: parentStyle.overflowY,
                overflowPixels: Math.round(Math.max(
                  parentRect.left - rect.left, rect.right - parentRect.right,
                  parentRect.top - rect.top, rect.bottom - parentRect.bottom, 0,
                )),
              };
              break;
            }
          }
        }
        if (negative || clipped) findings.push({ element: describe(element), negative, clipped });
      }
      return { count: findings.length, findings: findings.slice(0, 20) };
    });
    const negative = result.findings.some((item) => item.negative);
    return check('childOverflow', negative ? 'error' : result.count ? 'warning' : 'pass', result);
  });
}

function surfacePaddingCheck(page) {
  return guard('surfacePadding', async () => {
    const result = await page.evaluate(() => {
      const findings = [];
      const ignored = { flat: 0, empty: 0, hidden: 0 };
      const sides = ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'];
      const flatPattern = /(^|\s)(surface--flat|pad-none|surface--pad-none)(\s|$)/;
      const hasVisibleContent = (element) => {
        if ((element.textContent ?? '').trim()) return true;
        for (const child of element.children) {
          const style = getComputedStyle(child);
          if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
          const rect = child.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) return true;
        }
        return false;
      };
      for (const element of document.querySelectorAll('.surface, .section-card, .stat-card')) {
        const style = getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
          ignored.hidden += 1;
          continue;
        }
        const className = element.getAttribute('class') ?? '';
        if (flatPattern.test(className) || element.getAttribute('data-flat') === 'true') {
          ignored.flat += 1;
          continue;
        }
        if (!hasVisibleContent(element)) {
          ignored.empty += 1;
          continue;
        }
        if (!sides.every((side) => parseFloat(style[side]) === 0)) continue;
        findings.push({
          tag: element.tagName.toLowerCase(), className: className.slice(0, 120),
          text: (element.textContent ?? '').trim().slice(0, 60),
        });
      }
      return { count: findings.length, findings: findings.slice(0, 20), ignored };
    });
    return check('surfacePadding', result.count ? 'warning' : 'pass', result);
  });
}

function controlHeightCheck(page) {
  return guard('controlHeight', async () => {
    const result = await page.evaluate(() => {
      const findings = [];
      const compact = [];
      const compactPattern = /(^|\s)(btn-icon|icon-button|icon-btn|compact|compact-button|btn-compact|btn-sm)(\s|$)/;
      const inlineAncestor = 'p, li, summary, .footer-bottom, .marketing-footer-grid';
      const isStandaloneAnchor = (element) => {
        const className = String(element.getAttribute('class') ?? '');
        // Navigation-rail links and branding links are not standalone controls;
        // axe target-size covers their 24px minimum. Primary/action links use .btn.
        const controlLike = ['btn', 'button'].some((token) => className.includes(token)) ||
          element.getAttribute('role') === 'button' || element.getAttribute('data-audit-control') === 'true';
        return controlLike && !element.closest(inlineAncestor);
      };
      for (const element of document.querySelectorAll('button, input, select, textarea, a[href]')) {
        if (element.tagName === 'A' && !isStandaloneAnchor(element)) continue;
        const type = (element.getAttribute('type') ?? element.tagName.toLowerCase()).toLowerCase();
        if (type === 'hidden') continue;
        const style = getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) continue;
        if (rect.bottom <= 0 || rect.top >= innerHeight || rect.right <= 0 || rect.left >= innerWidth) continue;
        const className = String(element.getAttribute('class') ?? '');
        const label = element.getAttribute('aria-label') ?? (element.textContent ?? '').trim().slice(0, 60);
        const item = {
          tag: element.tagName.toLowerCase(), type, label,
          className: className.slice(0, 120), height: Math.round(rect.height * 10) / 10,
          scope: element.tagName === 'A' ? 'standalone-anchor' : 'native-control',
        };
        if (type === 'checkbox' || type === 'radio') compact.push({ ...item, reason: 'native selection control' });
        else if (compactPattern.test(className) || element.getAttribute('data-compact') === 'true' ||
          (element.tagName === 'BUTTON' && element.getAttribute('aria-label') && !(element.textContent ?? '').trim())) {
          compact.push({ ...item, reason: 'explicit compact/icon control' });
        } else if (item.height < 40) findings.push({ ...item, severity: 'error' });
        else if (item.height < 44) findings.push({ ...item, severity: 'warning' });
      }
      return {
        threshold: { errorBelow: 40, warningBelow: 44 }, count: findings.length,
        scope: 'native controls and standalone anchors only',
        findings: findings.slice(0, 25), compactExceptionCount: compact.length,
        compactExceptions: compact.slice(0, 10),
      };
    });
    const status = result.findings.some((item) => item.severity === 'error') ? 'error' : result.count ? 'warning' : 'pass';
    return check('controlHeight', status, result);
  });
}

function copyContractCheck(page, route) {
  if (route !== '/') {
    return Promise.resolve(check('copyContract', 'skip', { reason: 'landing-page copy contract applies only to /' }));
  }
  return guard('copyContract', async () => {
    const copy = await page.evaluate((expectedCopy) => {
      const normalize = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
      const hero = document.querySelector('.marketing-hero') ?? document.querySelector('main');
      const findExact = (selector, expected) => {
        if (!hero) return [];
        return Array.from(hero.querySelectorAll(selector))
          .filter((element) => normalize(element.textContent) === expected)
          .map((element) => ({
            tag: element.tagName.toLowerCase(),
            className: (element.getAttribute('class') ?? '').slice(0, 120),
            text: normalize(element.textContent),
          }));
      };
      return {
        heroFound: Boolean(hero),
        heading: findExact('h1', expectedCopy.heading),
        lede: findExact('.hero-lede', expectedCopy.lede),
      };
    }, ROOT_COPY);
    const hero = page.locator('.marketing-hero').first();
    const ctas = [];
    for (const name of ROOT_COPY.ctas) {
      const byRole = [];
      for (const role of ['link', 'button']) {
        const locator = hero.getByRole(role, { name, exact: true });
        const count = await locator.count();
        const samples = count ? await locator.evaluateAll((nodes) => nodes.slice(0, 5).map((node) => ({
          tag: node.tagName.toLowerCase(),
          className: (node.getAttribute('class') ?? '').slice(0, 120),
          text: (node.textContent ?? '').trim().slice(0, 80),
          href: node.getAttribute('href'),
        }))) : [];
        byRole.push({ role, count, samples });
      }
      ctas.push({ name, byRole, count: byRole.reduce((sum, role) => sum + role.count, 0) });
    }
    const issues = [];
    const requireExactlyOne = (label, expected, count, found) => {
      if (count === 1) return;
      issues.push({ label, expected, count, reason: count ? 'duplicated' : 'missing', found });
    };
    requireExactlyOne('hero heading', ROOT_COPY.heading, copy.heading.length, copy.heading);
    requireExactlyOne('hero lede', ROOT_COPY.lede, copy.lede.length, copy.lede);
    for (const cta of ctas) requireExactlyOne(`hero CTA "${cta.name}"`, cta.name, cta.count, cta.byRole);
    return check('copyContract', issues.length ? 'error' : 'pass', {
      scope: '.marketing-hero',
      matching: 'whitespace-normalized exact text; exact accessible name for CTAs',
      expected: ROOT_COPY,
      found: { heading: copy.heading, lede: copy.lede, ctas },
      issues,
    });
  });
}

function heroFitCheck(page, route, viewport) {
  if (route !== '/' || !HERO_VIEWPORTS.has(viewport.label)) {
    return Promise.resolve(check('heroFit', 'skip', { reason: 'not a landing-page hero viewport' }));
  }
  return guard('heroFit', async () => {
    const result = await page.evaluate(() => {
      const rectOf = (element) => {
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return {
          top: Math.round(rect.top), left: Math.round(rect.left), bottom: Math.round(rect.bottom),
          right: Math.round(rect.right), width: Math.round(rect.width), height: Math.round(rect.height),
          text: (element.textContent ?? '').trim().slice(0, 90),
        };
      };
      const h1 = rectOf(document.querySelector('h1'));
      const lede = rectOf(document.querySelector('.hero-lede'));
      const primaryCta = rectOf(document.querySelector('.hero-actions .btn-primary, .hero-actions a[href]'));
      const viewportHeight = window.innerHeight;
      const visible = [h1, lede, primaryCta].every((rect) =>
        rect && rect.width > 0 && rect.height > 0 && rect.top >= -1 && rect.bottom <= viewportHeight + 1);
      return { viewportHeight, h1, lede, primaryCta, visible };
    });
    return check('heroFit', result.visible ? 'pass' : 'error', result);
  });
}

function landmarksCheck(page, route, kind) {
  return guard('landmarks', async () => {
    const result = await page.evaluate(() => ({
      mainCount: document.querySelectorAll('main').length,
      headerCount: document.querySelectorAll('header').length,
    }));
    const sectionsCount = await page.getByRole('navigation', { name: SECTIONS_NAV_NAME, exact: true }).count();
    const authenticated = kind === 'authenticated';
    const issues = [];
    if (result.mainCount !== 1) issues.push({ label: 'main landmark', expected: 1, found: result.mainCount });
    if (!authenticated && result.headerCount < 1) issues.push({ label: 'header landmark', expected: 'at least 1', found: result.headerCount });
    if (authenticated && sectionsCount < 1) {
      issues.push({ label: `navigation landmark named "${SECTIONS_NAV_NAME}"`, expected: 'at least 1', found: sectionsCount });
    }
    return check('landmarks', issues.length ? 'error' : 'pass', {
      route, kind, ...result, sectionsNavCount: sectionsCount, issues,
    });
  });
}

function consoleNetworkCheck(data) {
  const entries = {
    consoleErrors: data.consoleErrors, consoleWarnings: data.consoleWarnings,
    pageErrors: data.pageErrors, failedResponses: data.failedResponses, requestFailures: data.requestFailures,
  };
  const issueCount = Object.values(entries).reduce((sum, list) => sum + list.length, 0);
  return check('consoleNetwork', issueCount ? 'error' : 'pass', { ...entries, issueCount });
}

function axeCheck(page) {
  return guard('axe', async () => {
    const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    const violations = results.violations.map((violation) => ({
      id: violation.id, impact: violation.impact, help: violation.help, helpUrl: violation.helpUrl,
      nodeCount: violation.nodes.length,
      nodes: violation.nodes.slice(0, 10).map((node) => ({ target: node.target, failureSummary: node.failureSummary })),
    }));
    return check('axe', violations.length ? 'error' : 'pass', {
      tags: AXE_TAGS, violationCount: violations.length, violations,
      incompleteCount: results.incomplete?.length ?? 0,
    });
  });
}

function clsCheck(page) {
  return guard('cls', async () => {
    const shifts = await page.evaluate(() => window.__uiAuditShifts ?? []);
    const total = shifts.reduce((sum, shift) => sum + Number(shift.value ?? 0), 0);
    return check('cls', total >= 0.05 ? 'error' : 'pass', {
      threshold: 0.05, cumulativeScore: Number(total.toFixed(4)),
      shiftCount: shifts.length, shifts: shifts.slice(0, 10),
    });
  });
}

function imageCheck(page) {
  return guard('images', async () => {
    const result = await page.evaluate(async () => {
      const urls = (value) => String(value ?? '').split(',')
        .map((part) => part.trim().split(/\s+/)[0]).filter(Boolean)
        .map((candidate) => new URL(candidate, location.href).href);
      const images = [];
      const candidates = new Set();
      for (const image of document.querySelectorAll('img')) {
        const src = image.currentSrc || image.src;
        if (src) candidates.add(src);
        for (const candidate of urls(image.getAttribute('srcset'))) candidates.add(candidate);
        const decorative = Boolean(image.closest('[aria-hidden="true"]')) ||
          image.getAttribute('role') === 'presentation' || image.getAttribute('aria-hidden') === 'true';
        images.push({
          src, srcset: image.getAttribute('srcset'), alt: image.getAttribute('alt'), decorative,
          missingAlt: !decorative && !image.hasAttribute('alt'),
          broken: Boolean(src) && image.complete && image.naturalWidth === 0,
        });
      }
      for (const source of document.querySelectorAll('picture source')) {
        const found = urls(source.getAttribute('srcset'));
        for (const candidate of found) candidates.add(candidate);
        images.push({ source: true, srcset: source.getAttribute('srcset'), candidates: found });
      }
      const resolution = [];
      for (const url of Array.from(candidates).slice(0, 40)) {
        if (/^(data:|blob:)/.test(url)) { resolution.push({ url: url.slice(0, 120), ok: true, skipped: true }); continue; }
        try {
          const response = await fetch(url, { method: 'HEAD', cache: 'no-store' });
          resolution.push({ url, status: response.status, ok: response.ok });
        } catch (error) { resolution.push({ url, status: 0, ok: false, error: String(error) }); }
      }
      return {
        note: 'Decorative SVG/CSS art is acceptable; aria-hidden or role=presentation images are exempt from alt.',
        imageCount: images.length, images: images.slice(0, 40), resolution,
      };
    });
    const failed = result.images.some((item) => item.broken || item.missingAlt) ||
      result.resolution.some((item) => !item.ok);
    return check('images', failed ? 'error' : 'pass', result);
  });
}

function motionPropertiesCheck(page) {
  return guard('motionProperties', async () => {
    const result = await page.evaluate(() => {
      const findings = [];
      const inaccessible = [];
      const vendorPrefixes = ['-webkit-', '-moz-', '-ms-', '-o-'];
      const allowed = new Set([
        'transform', 'opacity', 'filter', 'box-shadow', 'border-color', 'background-color',
        'color', 'stroke', 'fill', 'clip-path',
      ]);
      const timingFunctions = new Set([
        'linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out',
        'step-start', 'step-end', 'steps', 'cubic-bezier',
      ]);
      const timePattern = /^-?(?:\d+\.?\d*|\.\d+)(?:ms|s)$/i;
      const normalizeProperty = (property) => {
        let name = String(property ?? '').trim().toLowerCase();
        if (name.startsWith('--')) return { name, custom: true };
        for (const prefix of vendorPrefixes) {
          if (name.startsWith(prefix)) { name = name.slice(prefix.length); break; }
        }
        return { name, custom: false };
      };
      const isForbidden = (property) => {
        const { name, custom } = normalizeProperty(property);
        if (custom || !name || allowed.has(name)) return false;
        return (
          ['width', 'height', 'top', 'left', 'right', 'bottom', 'gap', 'row-gap', 'column-gap', 'box-flex'].includes(name) ||
          name.startsWith('margin') || name.startsWith('padding') ||
          name.startsWith('flex') || name.startsWith('grid-')
        );
      };
      const splitTopLevel = (value, separator = ',') => {
        const parts = [];
        let depth = 0;
        let current = '';
        for (const char of String(value ?? '')) {
          if (char === '(' || char === '[') depth += 1;
          else if (char === ')' || char === ']') depth = Math.max(0, depth - 1);
          if (char === separator && depth === 0) {
            if (current.trim()) parts.push(current.trim());
            current = '';
          } else current += char;
        }
        if (current.trim()) parts.push(current.trim());
        return parts;
      };
      const splitWhitespace = (value) => {
        const tokens = [];
        let depth = 0;
        let current = '';
        for (const char of String(value ?? '')) {
          if (char === '(' || char === '[') depth += 1;
          else if (char === ')' || char === ']') depth = Math.max(0, depth - 1);
          if (/\s/.test(char) && depth === 0) {
            if (current) tokens.push(current);
            current = '';
          } else current += char;
        }
        if (current) tokens.push(current);
        return tokens;
      };
      const isTimingToken = (token) => timingFunctions.has(token.split('(')[0].toLowerCase());
      const isPropertyToken = (token) => {
        if (!token || ['all', 'none', 'inherit', 'initial', 'unset', 'revert', 'revert-layer'].includes(token.toLowerCase())) return false;
        if (/^(?:var|env|calc|min|max|clamp)\(/i.test(token)) return false;
        if (timePattern.test(token) || isTimingToken(token)) return false;
        return /^(?:--|-?[a-z])[a-z0-9-]*$/i.test(token);
      };
      // Only transition declarations and @keyframe bodies are motion contracts.
      // Static width/padding/etc. declarations are layout, not animation.
      const transitionProperties = (property, value) => {
        const names = [];
        const normalized = normalizeProperty(property).name;
        if (normalized === 'transition-property') {
          for (const part of splitTopLevel(value)) {
            if (isPropertyToken(part)) names.push(part);
          }
          return names;
        }
        for (const part of splitTopLevel(value)) {
          const token = splitWhitespace(part).find(isPropertyToken);
          if (token) names.push(token);
        }
        return names;
      };
      const addFinding = ({ sheet, selector, property, value, context }) => {
        findings.push({
          stylesheet: sheet.href, selector, property,
          value: String(value ?? '').trim().slice(0, 240), context,
        });
      };
      const scanStyle = (style, selector, sheet, context) => {
        if (!style) return;
        for (let index = 0; index < style.length; index += 1) {
          const property = style[index];
          const value = style.getPropertyValue(property);
          const normalized = normalizeProperty(property).name;
          if (normalized === 'transition' || normalized === 'transition-property') {
            for (const name of transitionProperties(property, value)) {
              if (isForbidden(name)) addFinding({ sheet, selector, property: name, value, context: `${context}: ${property}` });
            }
            continue;
          }
          if (context === 'keyframe' && isForbidden(property)) {
            addFinding({ sheet, selector, property, value, context });
          }
        }
      };
      const walkRules = (rules, sheet) => {
        for (const rule of rules ?? []) {
          const isKeyframes = rule.type === 7 ||
            (typeof CSSRule !== 'undefined' && CSSRule.KEYFRAMES_RULE === rule.type);
          if (isKeyframes) {
            const name = rule.name ?? '';
            for (const frame of rule.cssRules ?? []) {
              scanStyle(frame.style, `keyframes ${name} / ${frame.selectorText ?? ''}`, sheet, 'keyframe');
            }
            continue;
          }
          if (rule.cssRules) walkRules(rule.cssRules, sheet);
          if (rule.style && rule.selectorText) scanStyle(rule.style, rule.selectorText, sheet, 'rule');
        }
      };
      for (const sheet of document.styleSheets) {
        const meta = { href: sheet.href ?? 'inline' };
        try {
          walkRules(sheet.cssRules, meta);
        } catch (error) {
          inaccessible.push({ stylesheet: meta.href, message: String(error) });
        }
      }
      return { findingCount: findings.length, findings, inaccessible };
    });
    return check('motionProperties', result.findingCount ? 'error' : 'pass', result);
  });
}

async function auditRun(page, route, viewport, kind) {
  const slug = `${slugFor(route)}-${viewport.label}`;
  const entry = { route, viewport: viewport.label, slug, kind, status: 'pass', screenshots: {}, checks: [] };
  const diagnostics = installDiagnostics(page);
  try {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await navigate(page, route);
    entry.checks.push(await overflowCheck(page));
    entry.checks.push(await childOverflowCheck(page));
    entry.checks.push(await surfacePaddingCheck(page));
    entry.checks.push(await controlHeightCheck(page));
    entry.checks.push(await copyContractCheck(page, route));
    entry.checks.push(await landmarksCheck(page, route, kind));
    entry.checks.push(await heroFitCheck(page, route, viewport));
    entry.checks.push(await axeCheck(page));
    entry.checks.push(consoleNetworkCheck(diagnostics.data));
    entry.checks.push(await clsCheck(page));
    entry.checks.push(await imageCheck(page));
    entry.checks.push(await motionPropertiesCheck(page));
    entry.status = statusOf(entry.checks);
    await page.screenshot({ path: path.join(OUT, `${slug}-viewport.png`) });
    await page.screenshot({ path: path.join(OUT, `${slug}-full.png`), fullPage: true });
    entry.screenshots = { viewport: evidenceFile(slug, 'viewport'), full: evidenceFile(slug, 'full') };
  } catch (error) {
    entry.status = 'error';
    entry.checks.push(check('run', 'error', { message: message(error) }));
  } finally { diagnostics.detach(); }
  return entry;
}

function skippedRun(route, viewport, reason) {
  return {
    route, viewport: viewport.label, slug: `${slugFor(route)}-${viewport.label}`, kind: 'authenticated',
    status: 'skip', reason, checks: [check('run', 'skip', { reason })], screenshots: {},
  };
}

async function loginViaUi(page) {
  const diagnostics = installDiagnostics(page);
  try {
    await navigate(page, '/login');
    await page.getByLabel('Email address').fill(EMAIL);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/\/app\/dashboard/, { timeout: 20_000 });
    await page.getByRole('navigation', { name: 'Sections' }).waitFor({ state: 'visible', timeout: 10_000 });
    const storageState = await page.context().storageState();
    return {
      status: 'pass', email: EMAIL, url: page.url(),
      storageState: {
        cookieCount: storageState.cookies.length, localStorageOriginCount: storageState.origins.length,
        note: 'Storage state is captured; the same authenticated context/page is reused because the refresh token lives in sessionStorage.',
      },
      diagnostics: diagnostics.data,
    };
  } catch (error) {
    return { status: 'error', email: EMAIL, message: message(error), diagnostics: diagnostics.data };
  } finally { diagnostics.detach(); }
}

async function routeTransitionCheck(page) {
  const diagnostics = installDiagnostics(page);
  try {
    await navigate(page, '/app/dashboard');
    const before = await page.evaluate(() => {
      window.__uiAuditTransitionSentinel = 'alive';
      return {
        timeOrigin: performance.timeOrigin, transitionPresent: Boolean(document.querySelector('.route-transition')),
        viewTransitionSupported: typeof document.startViewTransition === 'function',
        hasViewTransitionsClass: document.documentElement.classList.contains('has-view-transitions'),
      };
    });
    await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: 'Inventory' }).click();
    await page.waitForURL(/\/app\/inventory/, { timeout: 15_000 });
    await page.waitForTimeout(500);
    const after = await page.evaluate(() => ({
      sentinel: window.__uiAuditTransitionSentinel ?? null, timeOrigin: performance.timeOrigin,
      transitionPresent: Boolean(document.querySelector('.route-transition')),
      hasViewTransitionsClass: document.documentElement.classList.contains('has-view-transitions'),
    }));
    const fullReloadDetected = after.sentinel !== 'alive' || after.timeOrigin !== before.timeOrigin;
    const consoleErrors = diagnostics.data.consoleErrors;
    return {
      status: fullReloadDetected || consoleErrors.length ? 'error' : 'pass',
      from: '/app/dashboard', to: '/app/inventory', fullReloadDetected,
      routeTransitionObserved: before.transitionPresent || after.transitionPresent || after.hasViewTransitionsClass,
      viewTransitionSupported: before.viewTransitionSupported, targetUrl: page.url(), consoleErrors,
    };
  } catch (error) {
    return { status: 'error', from: '/app/dashboard', to: '/app/inventory', message: message(error) };
  } finally { diagnostics.detach(); }
}

async function reducedMotionCheck(page, route) {
  const diagnostics = installDiagnostics(page);
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await navigate(page, route);
    const result = await page.evaluate(() => {
      const running = [];
      const animations = document.getAnimations();
      for (const animation of animations) {
        const timing = animation.effect?.getTiming?.();
        if (!timing || timing.iterations !== Infinity || animation.playState !== 'running') continue;
        const target = animation.effect?.target;
        const visible = target instanceof Element && target.getClientRects().length > 0 &&
          getComputedStyle(target).visibility !== 'hidden';
        if (visible) running.push({
          name: animation.animationName ?? '', target: target.tagName.toLowerCase(),
          className: String(target.className ?? '').slice(0, 120),
        });
      }
      return {
        prefersReducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
        totalAnimations: animations.length, runningLoopCount: running.length, running,
      };
    });
    return {
      status: result.prefersReducedMotion && result.runningLoopCount === 0 ? 'pass' : 'error',
      route, viewport: '390x844', ...result, consoleErrors: diagnostics.data.consoleErrors,
    };
  } catch (error) {
    return { status: 'error', route, viewport: '390x844', message: message(error) };
  } finally {
    diagnostics.detach();
    await page.emulateMedia({ reducedMotion: 'no-preference' }).catch(() => {});
  }
}

function printRun(entry) {
  const tally = { error: 0, warning: 0, skip: 0, pass: 0 };
  for (const item of entry.checks) tally[item.status] = (tally[item.status] ?? 0) + 1;
  console.log(`${entry.status.toUpperCase().padEnd(7)} ${entry.route} @ ${entry.viewport}  E${tally.error} W${tally.warning} S${tally.skip} P${tally.pass}`);
  for (const item of entry.checks) {
    if (['error', 'warning'].includes(item.status)) {
      console.log(`  ${item.status}: ${item.name}${item.message ? ` — ${item.message}` : ''}`);
    }
  }
}

function finalize(report) {
  const checks = report.runs.flatMap((run) => run.checks);
  const special = [report.login, report.routeTransition, ...report.reducedMotion].filter(Boolean);
  const errors = checks.filter((item) => item.status === 'error').length +
    special.filter((item) => item.status === 'error').length;
  const countRuns = (status) => report.runs.filter((run) => run.status === status).length;
  const countChecks = (status) => checks.filter((item) => item.status === status).length;
  report.summary = {
    runs: report.runs.length, passedRuns: countRuns('pass'), warningRuns: countRuns('warning'),
    errorRuns: countRuns('error'), skippedRuns: countRuns('skip'), totalErrors: errors,
    totalWarnings: countChecks('warning'), skippedChecks: countChecks('skip'),
  };
  return errors;
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const report = {
    generatedAt: new Date().toISOString(), baseUrl: BASE_URL, browser: { channel: 'chrome', headless: true },
    credentials: { email: EMAIL }, viewports: VIEWPORTS.map((viewport) => viewport.label),
    routes: { public: PUBLIC_ROUTES, authenticated: AUTH_ROUTES },
    login: null, routeTransition: null, reducedMotion: [], runs: [], summary: {},
  };
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    report.browser.version = browser.version();
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
      const page = await context.newPage();
      await installClsObserver(page);
      for (const route of PUBLIC_ROUTES) {
        const entry = await auditRun(page, route, viewport, 'public');
        report.runs.push(entry);
        printRun(entry);
      }
      await context.close();
    }
    const authContext = await browser.newContext({ viewport: { width: VIEWPORTS[0].width, height: VIEWPORTS[0].height } });
    const authPage = await authContext.newPage();
    await installClsObserver(authPage);
    report.login = await loginViaUi(authPage);
    console.log(`LOGIN ${report.login.status.toUpperCase()} ${report.login.email}`);
    if (report.login.message) console.log(`  ${report.login.message}`);
    if (report.login.status === 'pass') {
      report.routeTransition = await routeTransitionCheck(authPage);
      console.log(`ROUTE TRANSITION ${report.routeTransition.status.toUpperCase()}`);
      for (const viewport of VIEWPORTS) {
        for (const route of AUTH_ROUTES) {
          const entry = await auditRun(authPage, route, viewport, 'authenticated');
          report.runs.push(entry);
          printRun(entry);
        }
      }
      for (const route of ['/', '/app/dashboard']) {
        const entry = await reducedMotionCheck(authPage, route);
        report.reducedMotion.push(entry);
        console.log(`REDUCED MOTION ${entry.status.toUpperCase()} ${route} @ 390x844`);
      }
    } else {
      const reason = `Login failed: ${report.login.message ?? 'unknown error'}`;
      for (const viewport of VIEWPORTS) {
        for (const route of AUTH_ROUTES) report.runs.push(skippedRun(route, viewport, reason));
      }
    }
    await authContext.close();
  } catch (error) {
    report.fatal = { message: message(error) };
    console.error(`FATAL ${report.fatal.message}`);
  } finally {
    if (browser) await browser.close().catch(() => {});
    const errors = finalize(report);
    await fs.writeFile(path.join(OUT, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
    console.log(`SUMMARY runs=${report.summary.runs} errors=${errors} warnings=${report.summary.totalWarnings} skips=${report.summary.skippedRuns} evidence=${path.relative(ROOT, OUT)}`);
    process.exitCode = errors > 0 ? 1 : 0;
  }
}

await main();
