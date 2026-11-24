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
 * A meow: a buzzy glottal source swept through moving formants, "m" (closed, dark) to "ee"
 * (bright) to "ow" (round), with the pitch rising then falling and a little breath noise.
 */
export function meow(ctx: Ctx, out: AudioNode, t: number, s: MeowShape): void {
  const d = s.dur;
  const src = ctx.createOscillator();
  src.type = 'sawtooth';
  src.frequency.setValueAtTime(s.pitch * 0.9, t);
  src.frequency.linearRampToValueAtTime(s.pitch * s.rise, t + d * 0.35);
  src.frequency.linearRampToValueAtTime(s.pitch * 0.82, t + d);
  // vibrato
  const vib = ctx.createOscillator();
  const vibAmt = ctx.createGain();
  vib.frequency.value = 6.5;
  vibAmt.gain.value = s.pitch * 0.025;
  vib.connect(vibAmt).connect(src.frequency);

  const breath = noise(ctx);
  const breathGain = ctx.createGain();
  breathGain.gain.value = 0.12;

  const mix = ctx.createGain();
  src.connect(mix);
  breath.connect(breathGain).connect(mix);

  // two formant bands moving through m → ee → ow
  const bands: [number, number, number, number][] = [
    // [start, peak, end, Q]
    [450, 1100, 700, 6],
    [1200, 2600, 1100, 8],
  ];
  const vowel = env(ctx, t, d * 0.18, d * 0.42, d * 0.4, s.vol);
  for (const [a, b, c, q] of bands) {
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = q;
    f.frequency.setValueAtTime(a, t);
    f.frequency.linearRampToValueAtTime(b, t + d * 0.35);
    f.frequency.linearRampToValueAtTime(c, t + d);
    mix.connect(f).connect(vowel);
  }
  // soft lowpass keeps it warm rather than buzzy
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 3200;
  vowel.connect(lp);

  let tail: AudioNode = lp;
  if (s.growl > 0) {
    // grumpy "mrrrow": fast amplitude wobble
    const trem = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lfoAmt = ctx.createGain();
    lfo.frequency.value = 28;
    lfoAmt.gain.value = 0.5 * s.growl;
    trem.gain.value = 1 - 0.5 * s.growl;
    lfo.connect(lfoAmt).connect(trem.gain);
    lp.connect(trem);
    tail = trem;
    lfo.start(t);
    lfo.stop(t + d + 0.05);
  }
  tail.connect(out);
  for (const n of [src, vib, breath]) {
    n.start(t);
    n.stop(t + d + 0.05);
  }
}

/** Per-coat voices, so every cat sounds a little different. */
export const VOICES: MeowShape[] = [
  { pitch: 620, dur: 0.26, rise: 1.35, growl: 0, vol: 0.55 }, // ginger
  { pitch: 540, dur: 0.3, rise: 1.25, growl: 0, vol: 0.55 }, // grey tabby
  { pitch: 720, dur: 0.24, rise: 1.4, growl: 0, vol: 0.5 }, // siamese, chatty and high
  { pitch: 470, dur: 0.32, rise: 1.2, growl: 0, vol: 0.6 }, // black, deeper
  { pitch: 800, dur: 0.22, rise: 1.45, growl: 0, vol: 0.5 }, // white kitten
  { pitch: 660, dur: 0.27, rise: 1.3, growl: 0, vol: 0.55 }, // calico
];

export function happyMew(ctx: Ctx, out: AudioNode, t: number, coat: number, pitchUp = 1): void {
  const v = VOICES[coat % VOICES.length];
  meow(ctx, out, t, { ...v, pitch: v.pitch * pitchUp });
}

export function grumpyMrrow(ctx: Ctx, out: AudioNode, t: number, coat: number): void {
  const v = VOICES[coat % VOICES.length];
  meow(ctx, out, t, { pitch: v.pitch * 0.72, dur: 0.48, rise: 1.15, growl: 0.8, vol: 0.65 });
  tone(ctx, out, t, 95, 0.12, 'sine', 0.5, 50); // the bump itself
}

export function pop(ctx: Ctx, out: AudioNode, t: number, step: number): void {
  const base = 520 * Math.pow(2, step / 12);
  tone(ctx, out, t, base, 0.12, 'sine', 0.35, base * 1.8);
  tone(ctx, out, t + 0.02, base * 2, 0.06, 'triangle', 0.1, base * 3);
}

/** Soft kalimba-like pluck: sine fundamental plus a quickly fading bright partial. */
export function pluck(ctx: Ctx, out: AudioNode, t: number, freq: number, vol: number, len = 0.9): void {
  tone(ctx, out, t, freq, len, 'sine', vol);
  tone(ctx, out, t, freq * 3.01, len * 0.18, 'sine', vol * 0.25);
}
