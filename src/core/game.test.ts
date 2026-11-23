import { describe, expect, it } from 'vitest';
import { GameState, START_LIVES } from './game';
import { generateLevel } from './generator';

describe('GameState', () => {
  it('bumps then exits in the tutorial row', () => {
    const g = new GameState(generateLevel(1));
    const r1 = g.tap(0, 1);
    expect(r1.kind).toBe('bump');
    expect(g.lives).toBe(START_LIVES - 1);
    expect(g.tap(2, 1).kind).toBe('exit');
    expect(g.tap(1, 1).kind).toBe('exit');
    expect(g.tap(0, 1).kind).toBe('exit');
    expect(g.won).toBe(true);
    expect(g.stars()).toBe(2);
  });

  it('can be finished by always following hints, with no mistakes', () => {
    for (const n of [3, 17, 55, 120]) {
      const g = new GameState(generateLevel(n));
      let guard = 1000;
      while (!g.won && guard-- > 0) {
        const c = g.hint()!;
        expect(g.tap(c.x, c.y).kind).toBe('exit');
      }
      expect(g.won).toBe(true);
      expect(g.stars()).toBe(3);
    }
  });

  it('loses after running out of lives', () => {
    const g = new GameState(generateLevel(1));
    g.tap(0, 1); g.tap(0, 1); g.tap(0, 1);
    expect(g.lost).toBe(true);
    expect(g.tap(2, 1).kind).toBe('none');
    g.addLife();
    expect(g.lost).toBe(false);
  });

  it('runs out of time on timed levels and can buy more', () => {
    const lvl = generateLevel(34); // a hard level past 25 is timed
    expect(lvl.kind).toBe('hard');
    expect(lvl.timeLimit).toBeGreaterThan(0);
    const g = new GameState(lvl);
    expect(g.tick(lvl.timeLimit! - 1)).toBe(false);
    expect(g.tick(5)).toBe(true);
    expect(g.loseReason).toBe('time');
    g.addTime(30);
    expect(g.lost).toBe(false);
    expect(g.timeLeft).toBe(30);
  });
});
