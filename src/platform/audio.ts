import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { MusicPlayer } from './music';
import { grumpyMrrow, happyMew, swish, tone } from './synth';

/**
 * Game audio, fully synthesised (no audio files to ship): sound effects and cat voices on one
 * bus, the background music on another, each with its own on/off switch.
 */
class Sfx {
  private ctx: AudioContext | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private music: MusicPlayer | null = null;
  enabled = true;
  musicEnabled = true;
  private combo = 0;
  private lastPop = 0;
  private lastMew = 0;

  /** Called when the app goes to the background, so nothing keeps playing. */
  suspend(): void {
    void this.ctx?.suspend();
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  /** Must be called from a user gesture on mobile browsers. */
  unlock(): void {
    if (this.ctx) {
      this.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const master = this.ctx.createGain();
    master.gain.value = 0.8;
    // a gentle compressor keeps overlapping meows from clipping
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    master.connect(comp).connect(this.ctx.destination);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = 0.6;
    this.sfxBus.connect(master);
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = 0.4; // music sits well under the cats
    this.musicBus.connect(master);
    this.music = new MusicPlayer(this.ctx, this.musicBus);
    if (this.musicEnabled) this.music.start();
  }

  setMusic(on: boolean): void {
    this.musicEnabled = on;
    if (!this.music) return;
    if (on) this.music.start();
    else this.music.stop();
  }

  private ready(): { ctx: AudioContext; out: GainNode } | null {
    if (!this.enabled || !this.ctx || !this.sfxBus) return null;
    return { ctx: this.ctx, out: this.sfxBus };
  }

  /** A cat is tapped and starts to run: just a light swish, the meow comes as it leaves. */
  escape(): void {
    const a = this.ready();
    if (!a) return;
    const now = performance.now();
    this.combo = now - this.lastPop < 900 ? Math.min(this.combo + 1, 10) : 0;
    this.lastPop = now;
    swish(a.ctx, a.out, a.ctx.currentTime);
  }

  /** The cat crosses the board edge: a happy mew in its own voice, a little higher in combos. */
  leave(coat: number): void {
    const a = this.ready();
    if (!a) return;
    const now = performance.now();
    // rapid escapes would turn into a choir: one mew per 160 ms is plenty
    if (now - this.lastMew < 160) return;
    this.lastMew = now;
    happyMew(a.ctx, a.out, a.ctx.currentTime, coat, 1 + this.combo * 0.02);
  }

  /** A cat runs into another one: a grumpy mrrow and a thud. */
  bump(coat: number): void {
    const a = this.ready();
    if (a) grumpyMrrow(a.ctx, a.out, a.ctx.currentTime, coat);
  }

  /** Home screen cats answering a tap. */
  mew(coat: number): void {
    const a = this.ready();
    if (a) happyMew(a.ctx, a.out, a.ctx.currentTime, coat, 1.05);
  }

  click(): void {
    const a = this.ready();
    if (a) tone(a.ctx, a.out, a.ctx.currentTime, 880, 0.05, 'triangle', 0.25, 660);
  }

  win(): void {
    const a = this.ready();
    if (!a) return;
    const t = a.ctx.currentTime;
    [523, 659, 784, 1047].forEach((f, i) => tone(a.ctx, a.out, t + i * 0.09, f, 0.22, 'triangle', 0.35));
    tone(a.ctx, a.out, t + 0.36, 1568, 0.4, 'sine', 0.2);
    happyMew(a.ctx, a.out, t + 0.5, 4, 1.1);
  }

  lose(): void {
    const a = this.ready();
    if (!a) return;
    const t = a.ctx.currentTime;
    [392, 330, 262].forEach((f, i) => tone(a.ctx, a.out, t + i * 0.14, f, 0.25, 'triangle', 0.3, f * 0.94));
  }

  hint(): void {
    const a = this.ready();
    if (!a) return;
    const t = a.ctx.currentTime;
    tone(a.ctx, a.out, t, 1200, 0.15, 'sine', 0.25, 1600);
    tone(a.ctx, a.out, t + 0.08, 1800, 0.2, 'sine', 0.15, 2400);
  }
}

export const sfx = new Sfx();

export const haptics = { enabled: true };

/** Short haptic tap: native haptics on the phone, the Vibration API in browsers. */
export function vibrate(ms: number): void {
  if (!haptics.enabled) return;
  if (Capacitor.isNativePlatform()) {
    void Haptics.impact({ style: ms >= 40 ? ImpactStyle.Medium : ImpactStyle.Light }).catch(() => {});
    return;
  }
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not supported */
  }
}
