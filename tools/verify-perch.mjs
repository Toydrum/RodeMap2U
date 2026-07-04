import { chromium } from 'playwright-core';
const BASE = 'http://localhost:' + (process.env.RM_PORT ?? '8826');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 480, height: 860 } });

const perch = () => page.locator('.session-perch').count();

// A — no session, no perch anywhere
await page.goto(`${BASE}/forest?seed=demo`, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
const idle = await perch();
console.log(`A idle: perch=${idle} | OK=${idle === 0}`);

// B — start a session from Ahora; the perch appears on forest/tree/trail, never on timer/ahora
await page.goto(`${BASE}/ahora`, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.locator('button', { hasText: 'Tocarla 2 minutitos' }).click();
await page.waitForTimeout(400);
const onAhora = await perch();
await page.goto(`${BASE}/forest`, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);
const onForest = await perch();
const perchTime = (await page.locator('.perch-time').textContent()).trim();
await page.goto(`${BASE}/tree/demo-guitar`, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);
const onTree = await perch();
await page.goto(`${BASE}/trail`, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);
const onTrail = await perch();
await page.goto(`${BASE}/timer`, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);
const onTimer = await perch();
console.log(`B travels: ahora=${onAhora} forest=${onForest}(${perchTime}) tree=${onTree} trail=${onTrail} timer=${onTimer} | OK=${onAhora === 0 && onForest === 1 && onTree === 1 && onTrail === 1 && onTimer === 0 && /\d:\d\d/.test(perchTime)}`);

// C — poses travel too (CLIENT-SIDE nav, like real taps: pause lives in memory)
await page.locator('button', { hasText: 'Pausa' }).click();
await page.waitForTimeout(200);
await page.locator('.tabbar .tab', { hasText: 'Mi bosque' }).click();
await page.waitForURL('**/forest**', { timeout: 5000 });
await page.waitForTimeout(300);
const restingAway = (await page.locator('.session-perch app-companion-bird.state-resting').count()) === 1;
console.log(`C paused pose travels: resting=${restingAway} | OK=${restingAway}`);

// D — tapping the perch returns to the session; finishing removes it everywhere
await page.locator('.session-perch').click();
await page.waitForURL('**/timer**', { timeout: 5000 });
await page.locator('button', { hasText: 'Seguir' }).click();
await page.locator('button', { hasText: 'Terminar' }).click();
await page.waitForTimeout(400);
await page.locator('.tabbar .tab', { hasText: 'Mi bosque' }).click();
await page.waitForURL('**/forest**', { timeout: 5000 });
await page.waitForTimeout(300);
const afterFinish = await perch();
console.log(`D tap returns + finish clears: perch=${afterFinish} | OK=${afterFinish === 0}`);

await browser.close();
