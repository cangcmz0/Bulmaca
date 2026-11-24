// Renders game audio offline (same synth code as the game) to WAV files.
// Needs `npx vite --port 5173`. Usage: node scripts/render-audio.cjs <kind> <seconds> <out.wav> [seed]
//   kind: music | meows | soundtrack (music with escape mews sprinkled in)
const { chromium } = require('playwright');
const fs = require('fs');

function wav(chL, chR, rate) {
  const n = chL.length, buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.max(-1, Math.min(1, chL[i])) * 32767 | 0, 44 + i * 4);
    buf.writeInt16LE(Math.max(-1, Math.min(1, chR[i])) * 32767 | 0, 46 + i * 4);
  }
  return buf;
}

(async () => {
  const [kind = 'music', secs = '30', out = 'out.wav', events = ''] = process.argv.slice(2);
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('http://localhost:5173/');
  const res = await p.evaluate(async ({ kind, secs, events }) => {
    const { MusicComposer } = await import('/src/platform/music.ts');
    const { happyMew, grumpyMrrow, pop } = await import('/src/platform/synth.ts');
    const rate = 44100, len = Math.ceil(+secs * rate);
    const ctx = new OfflineAudioContext(2, len, rate);
    const master = ctx.createGain(); master.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp).connect(ctx.destination);
    const musicBus = ctx.createGain(); musicBus.gain.value = kind === 'meows' ? 0 : 0.5; musicBus.connect(master);
    const sfxBus = ctx.createGain(); sfxBus.gain.value = 0.6; sfxBus.connect(master);
    if (kind !== 'meows') {
      const comp2 = new MusicComposer(ctx, musicBus);
      for (let bar = 0, t = 0.05; t < +secs; bar++, t += MusicComposer.barLength()) comp2.scheduleBar(bar, t);
      // fade out over the last 1.5 s
      musicBus.gain.setValueAtTime(0.5, +secs - 1.6); musicBus.gain.linearRampToValueAtTime(0, +secs - 0.1);
    }
    if (kind === 'meows') {
      for (let c = 0; c < 6; c++) happyMew(ctx, sfxBus, 0.2 + c * 0.6, c);
      for (let c = 0; c < 3; c++) grumpyMrrow(ctx, sfxBus, 4.0 + c * 0.8, c * 2);
      for (let i = 0; i < 8; i++) { pop(ctx, sfxBus, 6.6 + i * 0.18, i); happyMew(ctx, sfxBus, 6.63 + i * 0.18, i % 6, 1 + i * 0.025); }
    }
    // soundtrack events: "t:kind:coat:step" separated by commas
    for (const ev of events.split(',').filter(Boolean)) {
      const [t, k, coat, step] = ev.split(':');
      if (k === 'e') { pop(ctx, sfxBus, +t, +step || 0); happyMew(ctx, sfxBus, +t + 0.03, +coat, 1 + (+step || 0) * 0.025); }
      if (k === 'b') grumpyMrrow(ctx, sfxBus, +t, +coat);
    }
    const buf = await ctx.startRendering();
    const L = buf.getChannelData(0), R = buf.getChannelData(1);
    let peak = 0, sum = 0, nan = 0;
    for (let i = 0; i < L.length; i++) { const v = Math.abs(L[i]); if (Number.isNaN(L[i])) nan++; peak = Math.max(peak, v); sum += L[i] * L[i]; }
    return { L: Array.from(L), R: Array.from(R), rate, peak, rms: Math.sqrt(sum / L.length), nan };
  }, { kind, secs, events });
  fs.writeFileSync(out, wav(res.L, res.R, res.rate));
  console.log(`${out}: peak ${res.peak.toFixed(3)} rms ${res.rms.toFixed(4)} nan ${res.nan}`);
  await b.close();
})();
