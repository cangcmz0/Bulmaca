// Run: npm run build && npx vite preview --port 4173, then node scripts/qa-browser.cjs
// QA: for many levels, compare each cat's drawn facing with the direction it will actually run,
// then autoplay with hints (through the real tap handler) to check the level can be finished.
const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['Pixel 7'], deviceScaleFactor: 1, locale: 'tr-TR' });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:4173/?debug=1');
  await p.evaluate(() => localStorage.setItem('kedi-kacisi-save-v1', JSON.stringify({ seenKinds: ['spin','sleepy','scared'], hints: 999 })));
  await p.goto('http://localhost:4173/?debug=1');
  const levels = [3, 8, 9, 15, 25, 26, 33, 47, 60, 99, 120, 250, 500, 1000, 2500, 5000, 12000, 20000, 33333, 39999];
  const report = { mismatch: {}, scaredFlip: 0, scaredSame: 0 };
  for (const n of levels) {
    await p.evaluate((n) => window.__kk.start(n), n);
    await p.waitForTimeout(1900); // banner
    // play: each step check facing of all cats, then tap the hint cat via real pointer event
    const res = await p.evaluate(async () => {
      const kk = window.__kk;
      const out = { steps: 0, bad: [], scaredFlip: 0, scaredSame: 0, won: false, stuck: false };
      const st = () => kk.state;
      const board = document.getElementById('board');
      const tapCell = (x, y) => {
        const c = kk.renderer.cellCenter(x, y);
        const r = board.getBoundingClientRect();
        board.dispatchEvent(new PointerEvent('pointerdown', { clientX: r.left + c.px, clientY: r.top + c.py, bubbles: true }));
      };
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      for (let guard = 0; guard < 400 && st() && !st().won; guard++) {
        await wait(260); // let spin turn animations settle
        for (const c of st().cats.values()) {
          const g = kk.renderer.gazeOf(c.id);
          if (g === null) continue;
          const run = st().runDir(c);
          if (c.kind === 'scared') { if (g === (run + 2) % 4) out.scaredFlip++; else out.scaredSame++; continue; }
          if (g !== run) out.bad.push({ id: c.id, kind: c.kind || 'normal', drawn: g, runs: run, exits: st().exits });
        }
        const h = st().hint();
        if (h.kind !== 'move') { out.stuck = true; break; }
        if (st().asleep.has(h.cat.id)) { tapCell(h.cat.x, h.cat.y); await wait(50); }
        tapCell(h.cat.x, h.cat.y);
        out.steps++;
      }
      await wait(1500);
      out.won = !st() || st().won || document.getElementById('modal-title').textContent.length > 0;
      return out;
    });
    report.scaredFlip += res.scaredFlip; report.scaredSame += res.scaredSame;
    console.log(String(n).padStart(5), 'steps', res.steps, 'won', res.won, 'stuck', res.stuck, 'facing mismatches', res.bad.length, res.bad.slice(0, 3));
    await p.evaluate(() => document.getElementById('modal').classList.add('hidden'));
  }
  console.log('scared cats drawn facing opposite of run:', report.scaredFlip, 'same as run:', report.scaredSame);
  console.log('page errors:', errs);
  await b.close();
})();
