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

  it('gets deeper as levels progress', () => {
    const avg = (from: number, to: number) => {
      let s = 0;
      for (let n = from; n <= to; n++) { const l = generateLevel(n); s += solve(l.w, l.h, l.cats).depth; }
      return s / (to - from + 1);
    };
    expect(avg(101, 130)).toBeGreaterThan(avg(5, 10));
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
