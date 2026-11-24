import { Rng } from '../core/rng';
import { pluck } from './synth';

/**
 * Calm background music, generated on the fly: a soft pad, a quiet bass and a sparse kalimba
 * melody with a gentle echo, over Fmaj7 – Dm7 – Bbmaj7 – C7. No drums. Every 8-bar phrase gets a
 * new melody from a seeded random walk on the pentatonic scale, so it never loops audibly.
 */
const BPM = 68;
const SPB = 60 / BPM; // seconds per beat
const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

const CHORDS: number[][] = [
  [53, 57, 60, 64], // Fmaj7
  [50, 53, 57, 60], // Dm7
  [46, 50, 53, 57], // Bbmaj7
  [48, 52, 55, 58], // C7
];
const SCALE = [65, 67, 69, 72, 74, 77, 79, 81]; // F major pentatonic

export class MusicComposer {
  /** The melody goes through a soft echo so the sparse notes hang in the air. */
  private melodyBus: GainNode;

  constructor(private ctx: BaseAudioContext, private out: AudioNode) {
    this.melodyBus = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2200;
    const delay = ctx.createDelay(2);
    delay.delayTime.value = SPB * 0.75;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    this.melodyBus.connect(lp);
    lp.connect(out);
    lp.connect(delay);
    delay.connect(fb).connect(delay);
    delay.connect(wet).connect(out);
  }

  /** Schedules every note of bar `bar` starting at time `t`. */
  scheduleBar(bar: number, t: number): void {
    const ctx = this.ctx, out = this.out;
    const chord = CHORDS[bar % 4];
    const phrase = Math.floor(bar / 8);
    const rng = new Rng(9001 + phrase * 7919 + (bar % 8) * 31);
    const barLen = SPB * 4;

    // pad: warm detuned triangles, slow swell
    for (const m of chord) {
      for (const detune of [-6, 6]) {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = midi(m);
        o.detune.value = detune;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 700;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.015, t + 1.0);
        g.gain.setValueAtTime(0.015, t + barLen - 0.6);
        g.gain.exponentialRampToValueAtTime(0.0001, t + barLen + 0.5);
        o.connect(lp).connect(g).connect(out);
        o.start(t);
        o.stop(t + barLen + 0.6);
      }
    }

    // a quiet bass on beats 1 and 3
    for (const beat of [0, 2]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = midi(chord[0] - 12);
      const g = ctx.createGain();
      const bt = t + beat * SPB;
      g.gain.setValueAtTime(0.0001, bt);
      g.gain.exponentialRampToValueAtTime(0.08, bt + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, bt + SPB * 1.6);
      o.connect(g).connect(out);
      o.start(bt);
      o.stop(bt + SPB * 1.7);
    }

    // melody: sparse eighth-note grid, favouring chord tones on the beat
    const quietBar = bar % 8 < 2; // every phrase starts with two bars of just pad and bass
    let idx = 2 + Math.floor(rng.next() * 4);
    for (let e = 0; e < 8; e++) {
      if (quietBar) break;
      const onBeat = e % 2 === 0;
      if (rng.next() > (onBeat ? 0.42 : 0.12)) continue;
      idx = Math.max(0, Math.min(SCALE.length - 1, idx + [-2, -1, -1, 0, 1, 1, 2][rng.int(7)]));
      let m = SCALE[idx];
      if (onBeat && rng.next() < 0.5) {
        // snap to the nearest chord tone, an octave up
        m = chord.map((c) => c + 12).reduce((a, b) => (Math.abs(b - m) < Math.abs(a - m) ? b : a));
      }
      const swing = onBeat ? 0 : SPB * 0.08;
      pluck(ctx, this.melodyBus, t + e * SPB / 2 + swing, midi(m), 0.045 + rng.next() * 0.015, 1.4);
    }

  }

  static barLength(): number {
    return SPB * 4;
  }
}

/** Live player with a look-ahead scheduler and gentle fades. */
export class MusicPlayer {
  private gain: GainNode;
  private composer: MusicComposer;
  private timer = 0;
  private nextBar = 0;
  private nextTime = 0;
  playing = false;

  constructor(private ctx: AudioContext, out: AudioNode, private volume = 0.9) {
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.gain.connect(out);
    this.composer = new MusicComposer(ctx, this.gain);
  }

  start(): void {
    if (this.playing) return;
    this.playing = true;
    const now = this.ctx.currentTime;
    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.setValueAtTime(this.gain.gain.value, now);
    this.gain.gain.linearRampToValueAtTime(this.volume, now + 2.5);
    this.nextTime = Math.max(this.nextTime, now + 0.1);
    const tick = () => {
      while (this.nextTime < this.ctx.currentTime + 1.2) {
        this.composer.scheduleBar(this.nextBar++, this.nextTime);
        this.nextTime += MusicComposer.barLength();
      }
    };
    tick();
    this.timer = window.setInterval(tick, 300);
  }

  stop(): void {
    if (!this.playing) return;
    this.playing = false;
    clearInterval(this.timer);
    const now = this.ctx.currentTime;
    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.setValueAtTime(this.gain.gain.value, now);
    this.gain.gain.linearRampToValueAtTime(0, now + 0.8);
    // bars already scheduled play out silently; restart picks up from the next bar
    this.nextTime = now + 1.2;
  }
}
