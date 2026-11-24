// Plays levels in the real game through the UI (following hints) and reports anything odd:
// page errors, a level that doesn't end in a win, a "Cornered!" card while following winning
// hints, a hint that isn't a move, cats drawn facing a different way than they run.
// Needs: npm run build && npx vite preview --port 4173. Usage: node scripts/qa-levels.cjs 1-60 100 500 ...
const { chromium } = require('playwright');

const args = process.argv.slice(2).length ? process.argv.slice(2) : ['1-60'];
const levels = args.flatMap((a) => {
  const [x, y] = a.split('-').map(Number);
  return y ? Array.from({ length: y - x + 1 }, (_, i) => x + i) : [x];
});

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, locale: 'tr-TR' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:4173/?debug=1');
  await p.evaluate(() => localStorage.setItem('kedi-kacisi-save-v1', JSON.stringify({ seenKinds: ['spin', 'sleepy', 'scared'], reminders: { spin: 10, sleepy: 10, scared: 10 }, hints: 999 })));
  await p.goto('http://localhost:4173/?debug=1');
  const problems = [];
  const t0 = Date.now();
  for (const n of levels) {
    const res = await p.evaluate(async (n) => {
      const kk = window.__kk;
      document.getElementById('modal').classList.add('hidden');
      kk.start(n);
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      await wait(n >= 10 && (n % 10 === 0 || n % 10 === 4 || n % 10 === 7) ? 1700 : 120); // banner
      const board = document.getElementById('board');
      const out = { n, cats: kk.state.cats.size, kind: kk.state.level.kind, steps: 0, issues: [] };
      const trapped = document.getElementById('modal-title');
      for (let guard = 0; guard < 400 && !kk.state.won; guard++) {
        const st = kk.state;
        // drawn facing vs real run direction (scared cats look the other way on purpose)
        for (const c of st.cats.values()) {
          const g = kk.renderer.gazeOf(c.id);
          if (g === null || c.kind === 'spin') continue;
          const run = st.runDir(c);
          if (c.kind === 'scared' ? g !== (run + 2) % 4 : g !== run) out.issues.push(`cat ${c.id} drawn ${g} runs ${run}`);
        }
        const h = st.hint();
        if (h.kind !== 'move') { out.issues.push(`hint says doomed after ${out.steps} moves`); break; }
        const tap = () => {
          const c = kk.renderer.cellCenter(h.cat.x, h.cat.y), r = board.getBoundingClientRect();
          board.dispatchEvent(new PointerEvent('pointerdown', { clientX: r.left + c.px, clientY: r.top + c.py, bubbles: true }));
        };
        if (st.asleep.has(h.cat.id)) { tap(); await wait(20); }
        const before = st.history.length;
        tap();
        if (st.history.length === before) { out.issues.push(`hint cat ${h.cat.id} did not leave`); break; }
        out.steps++;
        await wait(40);
        if (!document.getElementById('modal').classList.contains('hidden') && !kk.state.won) {
          out.issues.push(`card "${trapped.textContent}" while following hints`);
          break;
        }
      }
      // wait for the last cat to run off and the win card to appear (up to 4 s)
      for (let i = 0; i < 40 && document.getElementById('modal').classList.contains('hidden'); i++) await wait(100);
      const title = trapped.textContent;
      if (!kk.state.won) out.issues.push('not won');
      else if (document.getElementById('modal').classList.contains('hidden')) out.issues.push('no win card');
      out.title = title;
      return out;
    }, n);
    const line = `${String(n).padStart(5)} ${res.kind.padEnd(8)} ${String(res.cats).padStart(3)} cats ${String(res.steps).padStart(3)} moves  ${res.issues.length ? '❌ ' + res.issues.slice(0, 3).join('; ') : '✓ ' + res.title}`;
    console.log(line);
    if (res.issues.length) problems.push(line);
  }
  console.log(`\n${levels.length} levels in ${((Date.now() - t0) / 1000).toFixed(0)} s, problems: ${problems.length}, page errors: ${errs.length}`);
  for (const e of errs.slice(0, 5)) console.log('  page error: ' + e);
  await b.close();
})();
