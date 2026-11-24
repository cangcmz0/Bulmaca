/**
 * Sound voices built from oscillators and filters. Every function takes the context, the node
 * to play into and a start time, so the same sounds work live in the game and in an
 * OfflineAudioContext when rendering promo video soundtracks.
 */
type Ctx = BaseAudioContext;

function env(ctx: Ctx, t: number, attack: number, hold: number, release: number, peak: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.setValueAtTime(peak, t + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
  return g;
}

export function tone(ctx: Ctx, out: AudioNode, t: number, freq: number, dur: number, type: OscillatorType, vol: number, glideTo?: number): void {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
  const g = env(ctx, t, 0.01, 0, dur, vol);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.05);
}

let noiseBuf: AudioBuffer | null = null;
export function noise(ctx: Ctx): AudioBufferSourceNode {
  if (!noiseBuf || noiseBuf.sampleRate !== ctx.sampleRate) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const n = ctx.createBufferSource();
  n.buffer = noiseBuf;
  n.loop = true;
  return n;
}

export interface MeowShape {
  /** base pitch in Hz (kitten ~ 700, adult ~ 450) */
  pitch: number;
  /** seconds */
  dur: number;
  /** pitch rise at the peak, as a ratio */
  rise: number;
  /** growl amount 0..1 (amplitude wobble for grumpy meows) */
  growl: number;
  vol: number;
}

/**
 * A meow, shaped like a real one: the mouth opens ("m"), the vowel brightens ("ee") and closes
 * again ("ow"). A soft mix of triangle and sawtooth is the voice; formant filters and a lowpass
 * that opens and closes with the "mouth" do the shaping; pitch glides up and back down smoothly.
 */
export function meow(ctx: Ctx, out: AudioNode, t: number, s: MeowShape): void {
  const d = s.dur;
  const curve = (pts: number[]) => {
    // smooth pitch contour through the given ratios
    const n = 64, c = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * (pts.length - 1), k = Math.min(pts.length - 2, Math.floor(x)), f = x - k;
      const e = f * f * (3 - 2 * f);
      c[i] = s.pitch * (pts[k] + (pts[k + 1] - pts[k]) * e);
    }
    return c;
  };
  const contour = curve([0.92, s.rise, s.rise * 0.97, 0.8]);
  const voices: [OscillatorType, number][] = [['triangle', 0.7], ['sawtooth', 0.28]];
  const mix = ctx.createGain();
  const oscs: AudioScheduledSourceNode[] = [];
  for (const [type, g] of voices) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueCurveAtTime(contour, t, d);
    const og = ctx.createGain();
    og.gain.value = g;
    o.connect(og).connect(mix);
    oscs.push(o);
  }
  // gentle vibrato, only on the held part
  const vib = ctx.createOscillator();
  const vibAmt = ctx.createGain();
  vib.frequency.value = 5.5;
  vibAmt.gain.setValueAtTime(0, t);
  vibAmt.gain.linearRampToValueAtTime(s.pitch * 0.018, t + d * 0.6);
  vib.connect(vibAmt);
  for (const o of oscs) vibAmt.connect((o as OscillatorNode).frequency);
  oscs.push(vib);
  // a breath of air
  const breath = noise(ctx);
  const bg = ctx.createGain();
  bg.gain.value = 0.04;
  breath.connect(bg).connect(mix);
  oscs.push(breath);

  // formants: m → ee → ow
  const shaped = ctx.createGain();
  const bands: [number, number, number, number, number][] = [
    // [start, peak, end, Q, gain]
    [700, 1300, 750, 3, 1],
    [1600, 2900, 1300, 5, 0.6],
    [3500, 3800, 3300, 6, 0.15],
  ];
  for (const [a, b2, c, q, g] of bands) {
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = q;
    f.frequency.setValueAtTime(a, t);
    f.frequency.linearRampToValueAtTime(b2, t + d * 0.3);
    f.frequency.linearRampToValueAtTime(c, t + d);
    const fg = ctx.createGain();
    fg.gain.value = g;
    mix.connect(f).connect(fg).connect(shaped);
  }
  // the "mouth": closed and dark at the start, open in the middle, rounding off at the end
  const mouth = ctx.createBiquadFilter();
  mouth.type = 'lowpass';
  mouth.Q.value = 0.7;
  mouth.frequency.setValueAtTime(500, t);
  mouth.frequency.exponentialRampToValueAtTime(3800, t + d * 0.28);
  mouth.frequency.exponentialRampToValueAtTime(1400, t + d);
  shaped.connect(mouth);
  const vol = env(ctx, t, d * 0.12, d * 0.5, d * 0.38, s.vol);
  mouth.connect(vol);

  let tail: AudioNode = vol;
  if (s.growl > 0) {
    // grumpy "mrrrow": a soft purr-like wobble
    const trem = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lfoAmt = ctx.createGain();
    lfo.frequency.value = 24;
    lfoAmt.gain.value = 0.35 * s.growl;
    trem.gain.value = 1 - 0.35 * s.growl;
    lfo.connect(lfoAmt).connect(trem.gain);
    vol.connect(trem);
    tail = trem;
    oscs.push(lfo);
  }
  tail.connect(out);
  for (const n of oscs) {
    n.start(t);
    n.stop(t + d + 0.05);
  }
}

/** Per-coat voices, so every cat sounds a little different. */
export const VOICES: MeowShape[] = [
  { pitch: 600, dur: 0.42, rise: 1.3, growl: 0, vol: 0.9 }, // ginger
  { pitch: 530, dur: 0.46, rise: 1.25, growl: 0, vol: 0.9 }, // grey tabby
  { pitch: 690, dur: 0.38, rise: 1.35, growl: 0, vol: 0.85 }, // siamese, chatty and high
  { pitch: 460, dur: 0.5, rise: 1.2, growl: 0, vol: 0.95 }, // black, deeper
  { pitch: 780, dur: 0.34, rise: 1.4, growl: 0, vol: 0.8 }, // white kitten
  { pitch: 640, dur: 0.4, rise: 1.3, growl: 0, vol: 0.9 }, // calico
];

export function happyMew(ctx: Ctx, out: AudioNode, t: number, coat: number, pitchUp = 1): void {
  const v = VOICES[coat % VOICES.length];
  meow(ctx, out, t, { ...v, pitch: v.pitch * pitchUp });
}

export function grumpyMrrow(ctx: Ctx, out: AudioNode, t: number, coat: number): void {
  const v = VOICES[coat % VOICES.length];
  meow(ctx, out, t, { pitch: v.pitch * 0.75, dur: 0.55, rise: 1.12, growl: 0.8, vol: 0.85 });
  tone(ctx, out, t, 110, 0.08, 'sine', 0.18, 70); // a soft bump, not a hit
}

/** The tap itself: a light paw-pat swish instead of a hard hit. */
export function swish(ctx: Ctx, out: AudioNode, t: number): void {
  const n = noise(ctx);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 1.2;
  bp.frequency.setValueAtTime(900, t);
  bp.frequency.exponentialRampToValueAtTime(2600, t + 0.12);
  const g = env(ctx, t, 0.02, 0.02, 0.1, 0.07);
  n.connect(bp).connect(g).connect(out);
  n.start(t);
  n.stop(t + 0.2);
}

export function pop(ctx: Ctx, out: AudioNode, t: number, step: number): void {
  const base = 520 * Math.pow(2, step / 12);
  tone(ctx, out, t, base, 0.12, 'sine', 0.35, base * 1.8);
  tone(ctx, out, t + 0.02, base * 2, 0.06, 'triangle', 0.1, base * 3);
}

/** Soft kalimba-like pluck: sine fundamental plus a quickly fading bright partial. */
export function pluck(ctx: Ctx, out: AudioNode, t: number, freq: number, vol: number, len = 0.9): void {
  tone(ctx, out, t, freq, len, 'sine', vol);
  tone(ctx, out, t, freq * 3.01, len * 0.12, 'sine', vol * 0.12);
}
