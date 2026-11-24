// Store screenshots (1080x1920) in Turkish and English, staged through the ?debug=1 hook.
// Needs a production preview: `npm run build && npx vite preview --port 4173`.
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const b = await chromium.launch();
  fs.mkdirSync('store/screenshots', { recursive: true });
  for (const lang of ['tr', 'en']) {
    const ctx = await b.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: lang === 'tr' ? 'tr-TR' : 'en-US' });
    const p = await ctx.newPage();
    const url = (q = '') => `http://localhost:4173/?debug=1&lang=${lang}${q}`;
    const shot = (n) => p.screenshot({ path: `store/screenshots/${lang}-${n}.png` });
    const seed = (extra) => p.evaluate((extra) => localStorage.setItem('kedi-kacisi-save-v1', JSON.stringify({
      level: 37, stars: Object.fromEntries(Array.from({ length: 36 }, (_, i) => [i + 1, (i % 4) ? 3 : 2])), hints: 5,
      streak: 6, dailyDone: new Date().toISOString().slice(0, 10), seenKinds: ['spin', 'sleepy', 'scared'],
      reminders: { spin: 10, sleepy: 10, scared: 10 }, giftDay: null, ...extra,
    })), extra);
    await p.goto(url()); await seed({}); await p.goto(url()); await p.waitForTimeout(900);
    // 1. home: tap the big cat for hearts
    const r = await p.locator('#home-scene').boundingBox();
    await p.mouse.click(r.x + r.width / 2, r.y + r.height * 0.55); await p.waitForTimeout(260);
    await shot('1-home');
    // 2. a mid level with every cat kind and its reminder tip
    await seed({ reminders: {} });
    await p.goto(url()); await p.evaluate(() => window.__kk.start(33)); await p.waitForTimeout(900);
    await shot('2-cats');
    // 3. hint in action on a bigger board
    await seed({});
    await p.goto(url()); await p.evaluate(() => window.__kk.start(64)); await p.waitForTimeout(700);
    await p.click('#hint-btn'); await p.waitForTimeout(450);
    await shot('3-hint');
    // 4. boss level banner with the clock
    await p.goto(url()); await p.evaluate(() => window.__kk.start(120)); await p.waitForTimeout(420);
    await shot('4-boss');
    // 5. a flawless win
    await p.goto(url()); await p.evaluate(() => window.__kk.start(36)); await p.waitForTimeout(500);
    await p.evaluate(async () => {
      const kk = window.__kk, board = document.getElementById('board');
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const tap = (x, y) => { const c = kk.renderer.cellCenter(x, y), rr = board.getBoundingClientRect(); board.dispatchEvent(new PointerEvent('pointerdown', { clientX: rr.left + c.px, clientY: rr.top + c.py, bubbles: true })); };
      while (kk.state && !kk.state.won) {
        const h = kk.state.hint(); if (h.kind !== 'move') break;
        if (kk.state.asleep.has(h.cat.id)) { tap(h.cat.x, h.cat.y); await wait(30); }
        tap(h.cat.x, h.cat.y); await wait(110);
      }
    });
    await p.waitForTimeout(1500);
    await shot('5-win');
    await ctx.close();
  }
  console.log('screenshots written to store/screenshots');
  await b.close();
})();
