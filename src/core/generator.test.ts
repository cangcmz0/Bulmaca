import { describe, expect, it } from 'vitest';
import { TOTAL_LEVELS, dailyLevel, generateLevel, kindFor } from './generator';
import { findSolution, freeCats, solve } from './solver';
import { Level, idx } from './types';

const winnable = (l: Level) => findSolution(l.w, l.h, l.cats).path !== null;
const avg = (from: number, to: number, f: (l: Level) => number, step = 1) => {
  let s = 0, k = 0;
  for (let n = from; n <= to; n += step) { s += f(generateLevel(n)); k++; }
  return s / k;
};

describe('generateLevel', () => {
  it('produces winnable, valid boards for the first 300 levels', () => {
    for (let n = 1; n <= 300; n++) {
      const l = generateLevel(n);
      expect(l.cats.length, `level ${n} has cats`).toBeGreaterThan(1);
      const seen = new Set<number>();
      for (const c of l.cats) {
        expect(c.x >= 0 && c.y >= 0 && c.x < l.w && c.y < l.h).toBe(true);
        expect(l.mask[idx(l.w, c.x, c.y)], `level ${n} cat on active cell`).toBe(true);
        const k = idx(l.w, c.x, c.y);
        expect(seen.has(k), `level ${n} no overlapping cats`).toBe(false);
        seen.add(k);
      }
      expect(winnable(l), `level ${n} winnable`).toBe(true);
    }
  });

  it('never hands out trivial boards after the tutorial', () => {
    for (let n = 3; n <= 60; n++) {
      const l = generateLevel(n);
      const free0 = freeCats(l.w, l.h, l.cats, 0).length;
      // easy levels are deliberate breathers before a boss
      expect(free0 / l.cats.length, `level ${n} free at start`).toBeLessThanOrEqual(l.kind === 'easy' ? 0.5 : 0.4);
      expect(l.meta!.depth, `level ${n} depth`).toBeGreaterThanOrEqual(4);
    }
  });

  it('demands planning: random tapping gets stuck more often as levels rise', () => {
    const early = avg(9, 40, (l) => l.meta!.stuckRate);
    const mid = avg(1001, 1100, (l) => l.meta!.stuckRate, 4);
    const late = avg(30001, 30200, (l) => l.meta!.stuckRate, 8);
    expect(early).toBeGreaterThan(0.1);
    expect(mid).toBeGreaterThan(early);
    expect(late).toBeGreaterThan(mid);
  });

  it('is deterministic', () => {
    expect(generateLevel(42)).toEqual(generateLevel(42));
  });

  it(`keeps getting harder right up to level ${TOTAL_LEVELS}`, () => {
    const chain = (from: number) => avg(from, from + 9, (l) => l.meta!.depth / l.cats.length);
    const perCat = (n: number) => { const l = generateLevel(n); return l.timeLimit! / l.cats.length; };
    expect(chain(5001)).toBeGreaterThan(chain(501));
    expect(chain(39991)).toBeGreaterThan(chain(10001));
    expect(perCat(39994)).toBeLessThan(perCat(3994));
    expect(kindFor(TOTAL_LEVELS)).toBe('boss');
  });

  it('generates very high levels quickly and winnably', () => {
    for (const n of [1000, 9999, 39999, 123456, 1000000]) {
      const t0 = performance.now();
      const l = generateLevel(n);
      expect(performance.now() - t0).toBeLessThan(2500);
      expect(winnable(l), `level ${n}`).toBe(true);
    }
  });

  it('follows the sawtooth: bosses are deeper than the easy level before them', () => {
    for (const block of [3, 8, 20]) {
      const easy = generateLevel(block * 10 + 9), boss = generateLevel(block * 10 + 10);
      expect(easy.kind).toBe('easy');
      expect(boss.kind).toBe('boss');
      expect(boss.meta!.depth).toBeGreaterThan(easy.meta!.depth);
    }
  });

  it('timed levels get tighter over time but never unfair', () => {
    const perCat = (n: number) => { const l = generateLevel(n); return l.timeLimit! / l.cats.length; };
    expect(generateLevel(17).timeLimit).toBeNull(); // no timers before level 20
    expect(generateLevel(10).timeLimit).toBeNull();
    expect(perCat(1004)).toBeLessThan(perCat(34));
    expect(perCat(1000004)).toBeGreaterThanOrEqual(1.5);
  });

  it('daily level is stable per day and winnable', () => {
    const a = dailyLevel(new Date('2026-11-23T05:00:00Z'));
    const b = dailyLevel(new Date('2026-11-23T22:00:00Z'));
    const c = dailyLevel(new Date('2026-11-24T05:00:00Z'));
    expect(a).toEqual(b);
    expect(a.cats).not.toEqual(c.cats);
    expect(winnable(a)).toBe(true);
  });
});

describe('solver', () => {
  it('detects a deadlock of two cats facing each other', () => {
    const r = solve(3, 1, [
      { id: 0, x: 0, y: 0, dir: 1, coat: 0 },
      { id: 1, x: 2, y: 0, dir: 3, coat: 0 },
    ]);
    expect(r.solvable).toBe(false);
  });

  it('spin cats make order matter', () => {
    // Row: [A→][S][ ] with spin S facing up (blocked by B above). A can't leave until S does.
    // S turns each exit: only leaving C first turns S to face right, then S, then A.
    const cats = [
      { id: 0, x: 0, y: 1, dir: 1 as const, coat: 0 },               // A faces right, blocked by S
      { id: 1, x: 1, y: 1, dir: 0 as const, coat: 0, kind: 'spin' as const }, // S faces up (B)
      { id: 2, x: 1, y: 0, dir: 3 as const, coat: 0 },               // B faces left: free
    ];
    const res = findSolution(3, 2, cats);
    expect(res.path).toEqual([2, 1, 0]);
  });
});
