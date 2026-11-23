import { describe, expect, it } from 'vitest';
import { dailyLevel, generateLevel } from './generator';
import { solve } from './solver';
import { idx } from './types';

describe('generateLevel', () => {
  it('produces solvable, valid boards for the first 300 levels', () => {
    for (let n = 1; n <= 300; n++) {
      const l = generateLevel(n);
      expect(l.cats.length, `level ${n} has cats`).toBeGreaterThan(1);
      const seen = new Set<number>();
      for (const c of l.cats) {
        expect(c.x).toBeGreaterThanOrEqual(0);
        expect(c.y).toBeGreaterThanOrEqual(0);
        expect(c.x).toBeLessThan(l.w);
        expect(c.y).toBeLessThan(l.h);
        expect(l.mask[idx(l.w, c.x, c.y)], `level ${n} cat on active cell`).toBe(true);
        const k = idx(l.w, c.x, c.y);
        expect(seen.has(k), `level ${n} no overlapping cats`).toBe(false);
        seen.add(k);
      }
      expect(solve(l.w, l.h, l.cats).solvable, `level ${n} solvable`).toBe(true);
    }
  });

  it('is deterministic', () => {
    expect(generateLevel(42)).toEqual(generateLevel(42));
  });

  it('gets harder as levels progress, with no upper limit', () => {
    const avg = (from: number, to: number) => {
      let s = 0;
      for (let n = from; n <= to; n++) { const l = generateLevel(n); s += solve(l.w, l.h, l.cats).depth; }
      return s / (to - from + 1);
    };
    const early = avg(5, 14), mid = avg(51, 60), late = avg(301, 310);
    expect(mid).toBeGreaterThan(early);
    expect(late).toBeGreaterThan(mid);
  });

  it('generates very high levels quickly and solvably', () => {
    for (const n of [1000, 9999, 123456, 1000000]) {
      const t0 = performance.now();
      const l = generateLevel(n);
      expect(performance.now() - t0).toBeLessThan(1500);
      expect(solve(l.w, l.h, l.cats).solvable).toBe(true);
    }
  });

  it('follows the sawtooth: bosses are harder than the easy level before them', () => {
    for (const block of [3, 8, 20]) {
      const easy = generateLevel(block * 10 + 9), boss = generateLevel(block * 10 + 10);
      expect(easy.kind).toBe('easy');
      expect(boss.kind).toBe('boss');
      expect(solve(boss.w, boss.h, boss.cats).depth).toBeGreaterThan(solve(easy.w, easy.h, easy.cats).depth);
    }
  });

  it('timed levels get tighter over time but never unfair', () => {
    const perCat = (n: number) => { const l = generateLevel(n); return l.timeLimit! / l.cats.length; };
    expect(generateLevel(24).timeLimit).toBeNull(); // no timers before level 25
    expect(perCat(1004)).toBeLessThan(perCat(34));
    expect(perCat(1000004)).toBeGreaterThanOrEqual(1.5);
  });

  it('daily level is stable per day and solvable', () => {
    const a = dailyLevel(new Date('2026-11-23T05:00:00Z'));
    const b = dailyLevel(new Date('2026-11-23T22:00:00Z'));
    const c = dailyLevel(new Date('2026-11-24T05:00:00Z'));
    expect(a).toEqual(b);
    expect(a.cats).not.toEqual(c.cats);
    expect(solve(a.w, a.h, a.cats).solvable).toBe(true);
  });
});

describe('solve', () => {
  it('detects a deadlock of two cats facing each other', () => {
    const r = solve(3, 1, [
      { id: 0, x: 0, y: 0, dir: 1, coat: 0 },
      { id: 1, x: 2, y: 0, dir: 3, coat: 0 },
    ]);
    expect(r.solvable).toBe(false);
  });
});
