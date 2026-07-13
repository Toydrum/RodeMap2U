// Shared verify-script harness (B6, 0.0.77+). New tools/verify-*.mjs MUST
// use these helpers; existing scripts migrate whenever they're touched.
// Keeping launch/sign-in/node-center in ONE place is how probe preambles
// stop drifting from the app (the 0.0.75 «Más detalles» fold broke four
// scripts that each carried their own copy).
import { chromium } from 'playwright-core';

export const BASE = 'http://localhost:' + (process.env.RM_PORT ?? '8826');

/** Standard browser + page. Desktop viewport unless overridden. */
export async function launchPage(viewport = { width: 900, height: 800 }) {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport });
  return { browser, page };
}

let failed = false;

/** Assertion printer — the battery greps `OK=false`, and the runner also
 *  checks the exit code, so both signals must stay honest. */
export function ok(label, cond, detail = '') {
  if (!cond) {
    failed = true;
    process.exitCode = 1;
  }
  console.log(`${label}${detail ? `: ${detail}` : ''} | OK=${!!cond}`);
  return !!cond;
}

export function anyFailed() {
  return failed;
}

/** Screen-space center of a canvas node (first `g.node` by default, or the
 *  nth). The world→screen math every canvas probe used to hand-copy. */
export async function nodeCenter(page, nth = 0) {
  return page.evaluate((index) => {
    const svg = document.querySelector('svg.canvas');
    const rect = svg.getBoundingClientRect();
    const t = (svg.querySelector(':scope > g').getAttribute('transform') ?? '').match(
      /translate\(([-\d.]+)\s+([-\d.]+)\)\s+scale\(([-\d.]+)\)/,
    );
    const [tx, ty, k] = t ? [Number(t[1]), Number(t[2]), Number(t[3])] : [0, 0, 1];
    const g = svg.querySelectorAll('g.node')[index];
    const nm = (g.getAttribute('transform') ?? '').match(/translate\(([-\d.]+)\s+([-\d.]+)\)/);
    return { x: rect.left + Number(nm[1]) * k + tx, y: rect.top + Number(nm[2]) * k + ty };
  }, nth);
}

/** Mock-cloud sign-in from anywhere (signs out a prior session first). */
export async function signInAs(page, username, password) {
  await page.goto(`${BASE}/account`, { waitUntil: 'networkidle' });
  if (await page.locator('h1', { hasText: 'Tu cuenta' }).count()) {
    await page.locator('button', { hasText: 'Cerrar sesión' }).click();
    await page.locator('h1', { hasText: 'Una llave' }).waitFor();
  }
  await page.locator('button', { hasText: 'Ya tengo mi llave' }).click();
  await page.fill('.auth-form input[autocomplete="username"]', username);
  await page.fill('.auth-form input[type="password"]', password);
  await page.locator('.auth-form button[type="submit"]').click();
  await page.locator('h1', { hasText: 'Tu cuenta' }).waitFor();
}

/** Walk the two-screen check-in ritual via skip and land on /ahora. */
export async function skipRitual(page) {
  await page.goto(`${BASE}/check-in`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const welcome = page.locator('button', { hasText: 'Empezar' });
  if (await welcome.count()) {
    await welcome.click();
    await page.waitForTimeout(250);
  }
  await page.locator('.skip').click();
  await page.waitForURL('**/ahora**');
}
