// Promo videos (1080x1920, H.264 + AAC) in Turkish and English, recorded from the real game.
// Needs both servers:  npm run build && npx vite preview --port 4173   and   npx vite --port 5173
// Usage: node scripts/make-videos.cjs [scenario...]   (default: all)
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const OUT = 'store/videos';
const TMP = path.join(require('os').tmpdir(), 'kedi-videos');
const ICON = 'data:image/png;base64,' + fs.readFileSync('store/icon-512.png').toString('base64');

const TEXT = {
  tr: {
    hookFail: 'Bunu çözebilir misin? 🤯', spinners: 'Fırıldaklara dikkat… 🌀', better: 'Sen daha iyisini yapabilir misin?',
    satisfying: 'Bu kadar tatmin edici olmamalı 😌', flawless: 'Kusursuz! ✨',
    spin: '🌀 Fırıldak: her kaçışta döner', sleepy: '😴 Uykucu: dokun, uyansın', scared: '😰 Korkak: TERS yöne kaçar', rules: '3 kedi, 40.000 bölüm',
    title: 'Kedi Kaçışı', tagline: 'Sırayı bul, kedileri kurtar!', cta: 'Ücretsiz oyna', store: "Google Play'de",
  },
  en: {
    hookFail: 'Can you solve this? 🤯', spinners: 'Watch the spinners… 🌀', better: 'Think you can do better?',
    satisfying: 'This is way too satisfying 😌', flawless: 'Flawless! ✨',
    spin: '🌀 Spinner: turns on every escape', sleepy: '😴 Sleepy: tap to wake', scared: '😰 Scaredy: runs BACKWARDS', rules: '3 cats, 40,000 levels',
    title: 'Cat Escape', tagline: 'Find the order, free the cats!', cta: 'Play free', store: 'on Google Play',
  },
};

/** Helpers injected into the page: captions, end card, taps that log sound events. */
const PAGE_HELPERS = () => {
  const style = document.createElement('style');
  style.textContent = `
    #tip { display: none !important; }
    .vcap { position: fixed; left: 16px; right: 16px; top: 62px; z-index: 50; text-align: center; pointer-events: none;
      font: 600 27px Fredoka, sans-serif; color: #fff; -webkit-text-stroke: 6px #4a3530; paint-order: stroke fill;
      animation: vpop .35s cubic-bezier(.2,1.6,.4,1) both; line-height: 1.15; }
    .vcap.bottom { top: auto; bottom: 26px; z-index: 70; }
    @keyframes vpop { from { transform: scale(.5); opacity: 0 } }
    .vend { position: fixed; inset: 0; z-index: 60; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px;
      background: linear-gradient(180deg,#ffc89a,#ff9e6b); animation: vfade .4s both; font-family: Fredoka, sans-serif; }
    @keyframes vfade { from { opacity: 0 } }
    .vend img { width: 150px; height: 150px; border-radius: 34px; border: 5px solid #4a3530; box-shadow: 0 8px 0 #4a3530; animation: vpop .5s .1s both; }
    .vend h1 { margin: 10px 0 0; font-size: 48px; color: #fff; -webkit-text-stroke: 7px #4a3530; paint-order: stroke fill; }
    .vend p { margin: 0; font-size: 21px; font-weight: 600; color: #4a3530; }
    .vend .cta { margin-top: 18px; padding: 14px 34px; border-radius: 24px; background: #ff7b54; color: #fff; font-size: 28px; font-weight: 600;
      border: 4px solid #4a3530; box-shadow: 0 6px 0 #4a3530; animation: vbeat 1s .6s infinite; }
    @keyframes vbeat { 50% { transform: scale(1.06) } }
    .vend small { font-size: 18px; font-weight: 600; color: #4a3530; opacity: .8; }`;
  document.head.appendChild(style);
  window.__v = {
    t0: performance.now(), wall: Date.now(), events: [], combo: 0, lastExit: -9,
    now() { return (performance.now() - this.t0) / 1000; },
    cap(text, where = 'top') {
      document.querySelectorAll('.vcap').forEach((e) => e.remove());
      if (!text) return;
      const d = document.createElement('div'); d.className = `vcap ${where}`; d.textContent = text; document.body.appendChild(d);
    },
    end(t, icon) {
      this.cap('');
      const d = document.createElement('div'); d.className = 'vend';
      d.innerHTML = `<img src="${icon}"><h1>${t.title}</h1><p>${t.tagline}</p><div class="cta">${t.cta} ▶</div><small>${t.store}</small>`;
      document.body.appendChild(d);
    },
    tap(cat) {
      const kk = window.__kk, board = document.getElementById('board');
      const c = kk.renderer.cellCenter(cat.x, cat.y), r = board.getBoundingClientRect();
      const before = kk.state.history.length, lives = kk.state.lives;
      board.dispatchEvent(new PointerEvent('pointerdown', { clientX: r.left + c.px, clientY: r.top + c.py, bubbles: true }));
      const t = this.now();
      if (kk.state.history.length > before) {
        this.combo = t - this.lastExit < 0.9 ? Math.min(this.combo + 1, 10) : 0;
        this.lastExit = t;
        this.events.push(`${t.toFixed(3)}:e:${cat.coat}:${this.combo}`);
      } else if (kk.state.lives < lives) this.events.push(`${(t + 0.12).toFixed(3)}:b:${cat.coat}`);
    },
    mark(kind) { this.events.push(`${this.now().toFixed(3)}:${kind}:0`); },
  };
};

const wait = (p, ms) => p.waitForTimeout(ms);

/** Taps a cat the way a player would: wakes it first if it is asleep. */
async function play(p, id, gap) {
  await p.evaluate((id) => {
    const st = window.__kk.state, cat = st.cats.get(id);
    if (!cat) return;
    if (st.asleep.has(id)) window.__v.tap(cat);
  }, id);
  await wait(p, 90);
  await p.evaluate((id) => { const cat = window.__kk.state.cats.get(id); if (cat) window.__v.tap(cat); }, id);
  await wait(p, gap);
}

async function playHints(p, count, gap) {
  for (let i = 0; i < count; i++) {
    const id = await p.evaluate(() => { const s = window.__kk.state; if (!s || s.won) return null; const h = s.hint(); return h.kind === 'move' ? h.cat.id : null; });
    if (id === null) break;
    await play(p, id, gap);
  }
}

const SCENARIOS = {
  // Hook → careless play → cornered → challenge → end card
  async cornered(p, t) {
    await p.evaluate(() => window.__kk.start(125));
    await p.evaluate(PAGE_HELPERS);
    await p.evaluate((s) => window.__v.cap(s), t.hookFail);
    await wait(p, 1300);
    const taps = [12, 4, 55, 5, 34, 39, 8, 37, 42, 28, 51, 23];
    for (let i = 0; i < taps.length; i++) {
      if (i === 6) await p.evaluate((s) => window.__v.cap(s), t.spinners);
      await play(p, taps[i], 560);
    }
    await wait(p, 600);
    await p.evaluate(() => { window.__v.cap(''); window.__v.mark('l'); });
    await wait(p, 1500);
    await p.evaluate((s) => window.__v.cap(s, 'bottom'), t.better);
    await wait(p, 2200);
    await p.evaluate(({ t, icon }) => window.__v.end(t, icon), { t, icon: ICON });
    await wait(p, 3200);
  },
  // Fast flawless solve with climbing combos and confetti
  async satisfying(p, t) {
    await p.evaluate(() => window.__kk.start(58));
    await p.evaluate(PAGE_HELPERS);
    await p.evaluate((s) => window.__v.cap(s), t.satisfying);
    await wait(p, 1000);
    await playHints(p, 80, 230);
    await wait(p, 500);
    await p.evaluate(() => { window.__v.cap(''); window.__v.mark('w'); });
    await wait(p, 2000);
    await p.evaluate((s) => window.__v.cap(s, 'bottom'), t.flawless);
    await wait(p, 800);
    await p.evaluate(({ t, icon }) => window.__v.end(t, icon), { t, icon: ICON });
    await wait(p, 3200);
  },
  // The three special cats, one short scene each (also works as the Play listing video)
  async cats(p, t) {
    await p.evaluate(() => window.__kk.start(8));
    await p.evaluate(PAGE_HELPERS);
    await p.evaluate((s) => window.__v.cap(s), t.spin);
    await wait(p, 900);
    await playHints(p, 9, 520);
    await p.evaluate(() => window.__kk.start(15));
    await p.evaluate((s) => window.__v.cap(s), t.sleepy);
    await wait(p, 700);
    const sleepy = await p.evaluate(() => [...window.__kk.state.asleep].slice(0, 3));
    for (const id of sleepy) {
      await p.evaluate((id) => window.__v.tap(window.__kk.state.cats.get(id)), id);
      await p.evaluate(() => window.__v.mark('h'));
      await wait(p, 700);
    }
    await playHints(p, 4, 450);
    await p.evaluate(() => window.__kk.start(25));
    await p.evaluate((s) => window.__v.cap(s), t.scared);
    await wait(p, 900);
    for (let i = 0; i < 6; i++) {
      // prefer free scared cats so the backwards run is on screen
      const id = await p.evaluate(() => {
        const s = window.__kk.state; const free = s.free();
        const scared = free.find((c) => c.kind === 'scared');
        if (scared) return scared.id;
        const h = s.hint(); return h.kind === 'move' ? h.cat.id : null;
      });
      if (id === null) break;
      await play(p, id, 650);
    }
    await p.evaluate((s) => window.__v.cap(s), t.rules);
    await playHints(p, 6, 260);
    await wait(p, 600);
    await p.evaluate(({ t, icon }) => window.__v.end(t, icon), { t, icon: ICON });
    await wait(p, 3200);
  },
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(TMP, { recursive: true });
  const which = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SCENARIOS);
  const b = await chromium.launch();
  for (const lang of ['tr', 'en']) {
    for (const name of which) {
      const dir = path.join(TMP, `${lang}-${name}`);
      fs.rmSync(dir, { recursive: true, force: true });
      const ctx = await b.newContext({
        viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
        locale: lang === 'tr' ? 'tr-TR' : 'en-US', recordVideo: { dir, size: { width: 1080, height: 1920 } },
      });
      const p = await ctx.newPage();
      const pageWall = Date.now();
      await p.goto(`http://localhost:4173/?debug=1&zoom=3&lang=${lang}`);
      await p.evaluate(() => localStorage.setItem('kedi-kacisi-save-v1', JSON.stringify({
        seenKinds: ['spin', 'sleepy', 'scared'], reminders: { spin: 10, sleepy: 10, scared: 10 }, hints: 5, sound: false, music: false,
      })));
      await p.goto(`http://localhost:4173/?debug=1&zoom=3&lang=${lang}`);
      await p.waitForTimeout(700);
      await SCENARIOS[name](p, TEXT[lang]);
      const { wall, events, dur } = await p.evaluate(() => ({ wall: window.__v.wall, events: window.__v.events, dur: window.__v.now() }));
      await ctx.close();
      const webm = fs.readdirSync(dir).find((f) => f.endsWith('.webm'));
      const offset = Math.max(0, (wall - pageWall) / 1000);
      const wav = path.join(TMP, `${lang}-${name}.wav`);
      execFileSync('node', ['scripts/render-audio.cjs', 'soundtrack', dur.toFixed(2), wav, events.join(',')], { stdio: 'inherit' });
      const out = path.join(OUT, `${lang}-${name}.mp4`);
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', offset.toFixed(3), '-i', path.join(dir, webm), '-i', wav,
        '-t', dur.toFixed(2), '-map', '0:v', '-map', '1:a', '-r', '30', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
        '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', out]);
      console.log(`${out}  ${dur.toFixed(1)} s, ${events.length} sound events`);
    }
  }
  await b.close();
})();
