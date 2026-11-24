// Renders the app icon, adaptive icon layers, splash screens and store graphics from the game's
// own cat drawing. Needs the Vite dev server: `npx vite --port 5173`, then `node scripts/make-icons.cjs`.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const RES = 'android/app/src/main/res';
const BG = '#ffb27a';

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('http://localhost:5173/');
  await p.waitForTimeout(800);
  const render = (spec) => p.evaluate(async (spec) => {
    const { drawCat, COATS, drawSpinRing } = await import('/src/render/cat.ts');
    await document.fonts.ready;
    const c = document.createElement('canvas');
    c.width = spec.w; c.height = spec.h;
    const ctx = c.getContext('2d');
    const { w, h } = spec;
    const bgGrad = () => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#ffc89a'); g.addColorStop(1, '#ff9e6b');
      return g;
    };
    if (spec.bg === 'square' || spec.bg === 'full') { ctx.fillStyle = bgGrad(); ctx.fillRect(0, 0, w, h); }
    if (spec.bg === 'rounded') {
      ctx.fillStyle = bgGrad();
      const r = w * 0.22;
      ctx.beginPath(); ctx.roundRect(0, 0, w, h, r); ctx.fill();
    }
    if (spec.bg === 'circle') { ctx.fillStyle = bgGrad(); ctx.beginPath(); ctx.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2); ctx.fill(); }
    if (spec.bg === 'splash') { ctx.fillStyle = '#ffd2b3'; ctx.fillRect(0, 0, w, h); }
    const pose = (x, y, s, extra = {}) => ({ x, y, s, angle: 0, stretch: 1, scale: 1, blink: false, dizzy: false, hurt: 0, tail: 0.3, running: 0, ...extra });
    if (spec.cat) {
      const s = Math.min(w, h) * spec.cat;
      // soft cushion glow behind the cat
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.arc(w / 2, h / 2, s * 0.62, 0, Math.PI * 2); ctx.fill();
      drawCat(ctx, COATS[0], pose(w / 2, h / 2 - s * 0.03, s));
    }
    if (spec.feature) {
      // store feature graphic: title on the left, a little cast of cats on the right
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      for (let i = 0; i < 40; i++) { ctx.beginPath(); ctx.arc((i * 137) % w, (i * 89) % h, 6, 0, Math.PI * 2); ctx.fill(); }
      ctx.font = `600 ${spec.titleSize}px Fredoka, sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 14; ctx.strokeStyle = '#4a3530';
      ctx.strokeText(spec.title, 60, h * 0.4);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(spec.title, 60, h * 0.4);
      ctx.font = `600 ${spec.titleSize * 0.36}px Fredoka, sans-serif`;
      ctx.lineWidth = 8;
      ctx.strokeText(spec.tagline, 64, h * 0.66);
      ctx.fillStyle = '#fff6c9';
      ctx.fillText(spec.tagline, 64, h * 0.66);
      drawCat(ctx, COATS[0], pose(w * 0.8, h * 0.52, 250));
      drawSpinRing(ctx, w * 0.64, h * 0.86, 120, 0.4, '#ff7b54');
      drawCat(ctx, COATS[1], pose(w * 0.64, h * 0.86, 110, { angle: Math.PI / 2 }));
      drawCat(ctx, COATS[5], pose(w * 0.9, h * 0.8, 100, { angle: -Math.PI / 2, sweat: true }));
      drawCat(ctx, COATS[3], pose(w * 0.64, h * 0.24, 100, { angle: Math.PI }));
    }
    return c.toDataURL('image/png').split(',')[1];
  }, spec);
  const write = async (file, spec) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(await render(spec), 'base64'));
  };

  const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  for (const [d, k] of Object.entries(dens)) {
    const legacy = Math.round(48 * k), fg = Math.round(108 * k);
    await write(`${RES}/mipmap-${d}/ic_launcher.png`, { w: legacy, h: legacy, bg: 'rounded', cat: 0.6 });
    await write(`${RES}/mipmap-${d}/ic_launcher_round.png`, { w: legacy, h: legacy, bg: 'circle', cat: 0.58 });
    // adaptive foreground: keep the cat inside the 66dp safe zone of the 108dp canvas
    await write(`${RES}/mipmap-${d}/ic_launcher_foreground.png`, { w: fg, h: fg, bg: 'none', cat: 0.54 });
    const pw = Math.round(320 * k), ph = Math.round(480 * k);
    await write(`${RES}/drawable-port-${d}/splash.png`, { w: pw, h: ph, bg: 'splash', cat: 0.42 });
    await write(`${RES}/drawable-land-${d}/splash.png`, { w: ph, h: pw, bg: 'splash', cat: 0.42 });
  }
  await write(`${RES}/drawable/splash.png`, { w: 480, h: 320, bg: 'splash', cat: 0.42 });
  await write('store/icon-512.png', { w: 512, h: 512, bg: 'full', cat: 0.66 });
  await write('store/feature-graphic-tr.png', { w: 1024, h: 500, bg: 'full', feature: true, title: 'Patikaç', tagline: 'Sırayı bul, kedileri kurtar!', titleSize: 118 });
  await write('store/feature-graphic-en.png', { w: 1024, h: 500, bg: 'full', feature: true, title: 'Patikaç', tagline: 'Find the order, free the cats!', titleSize: 118 });
  fs.writeFileSync(`${RES}/values/ic_launcher_background.xml`, `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BG.toUpperCase()}</color>\n</resources>\n`);
  console.log('icons, splash and store graphics written');
  await b.close();
})();
