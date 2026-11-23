/** Tiny WebAudio synth: no audio files to ship, every sound is generated. */
class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  enabled = true;
  private combo = 0;
  private lastPop = 0;

  /** Must be called from a user gesture on mobile browsers. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, glideTo?: number, delay = 0): void {
    if (!this.enabled || !this.ctx || !this.master) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  /** Exit pop; pitch climbs when cats leave in quick succession. */
  pop(): void {
    const now = performance.now();
    this.combo = now - this.lastPop < 900 ? Math.min(this.combo + 1, 10) : 0;
    this.lastPop = now;
    const base = 520 * Math.pow(2, this.combo / 12);
    this.tone(base, 0.12, 'sine', 0.5, base * 1.8);
    this.tone(base * 2, 0.06, 'triangle', 0.15, base * 3, 0.02);
  }

  meow(): void {
    if (!this.enabled || !this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const f = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(480, t);
    o.frequency.linearRampToValueAtTime(820, t + 0.1);
    o.frequency.linearRampToValueAtTime(560, t + 0.38);
    f.type = 'bandpass';
    f.Q.value = 4;
    f.frequency.setValueAtTime(900, t);
    f.frequency.linearRampToValueAtTime(1800, t + 0.12);
    f.frequency.linearRampToValueAtTime(1000, t + 0.38);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.6, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    o.connect(f).connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.45);
    this.tone(90, 0.12, 'sine', 0.6, 50); // thud
  }

  click(): void {
    this.tone(880, 0.05, 'triangle', 0.25, 660);
  }

  win(): void {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.35, undefined, i * 0.09));
    this.tone(1568, 0.4, 'sine', 0.2, undefined, 0.36);
  }

  lose(): void {
    [392, 330, 262].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.3, f * 0.94, i * 0.14));
  }

  hint(): void {
    this.tone(1200, 0.15, 'sine', 0.25, 1600);
    this.tone(1800, 0.2, 'sine', 0.15, 2400, 0.08);
  }
}

export const sfx = new Sfx();

export function vibrate(ms: number): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not supported */
  }
}
