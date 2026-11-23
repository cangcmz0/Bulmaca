import { describe, expect, it } from 'vitest';
import { GameState, START_LIVES } from './game';
import { INTRO, generateLevel } from './generator';

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

  it('can be finished by always following hints, with no mistakes, with every cat kind', () => {
    for (const n of [3, 8, 17, 33, 55, 84, 120, 777, 7994, 39990]) {
      const g = new GameState(generateLevel(n));
      let guard = 5000;
      while (!g.won && guard-- > 0) {
        const h = g.hint();
        expect(h.kind, `level ${n}`).toBe('move');
        if (h.kind !== 'move') break;
        if (g.asleep.has(h.cat.id)) expect(g.tap(h.cat.x, h.cat.y).kind).toBe('wake');
        expect(g.tap(h.cat.x, h.cat.y).kind, `level ${n}`).toBe('exit');
      }
      expect(g.won).toBe(true);
      expect(g.stars()).toBe(3);
    }
  });

  it('gets stuck with a careless order, and undo gets it back', () => {
    // Play random free cats until the board is stuck on a level built to punish that.
    const lvl = generateLevel(1000);
    let stuckSeen = false;
    for (let attempt = 0; attempt < 20 && !stuckSeen; attempt++) {
      const g = new GameState(lvl);
      g.asleep.clear();
      let r = attempt * 7919;
      while (!g.won && !g.stuck) {
        const free = g.free();
        const c = free[(r = (r * 1103515245 + 12345) >>> 0) % free.length];
        g.tap(c.x, c.y);
      }
      if (g.stuck) {
        stuckSeen = true;
        expect(g.loseReason).toBe('stuck');
        expect(g.hint().kind).toBe('doomed');
        // rewind until winnable again
        while (g.hint().kind === 'doomed') expect(g.undo()).toBeDefined();
        expect(g.stuck).toBe(false);
      }
    }
    expect(stuckSeen).toBe(true);
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
    const lvl = generateLevel(34); // a hard level past 20 is timed
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

  it('sleepy cats wake for free, scared cats run backwards', () => {
    const lvl = generateLevel(INTRO.sleepy);
    const sleepy = lvl.cats.filter((c) => c.kind === 'sleepy');
    expect(sleepy.length).toBe(3);
    const g = new GameState(lvl);
    const r = g.tap(sleepy[0].x, sleepy[0].y);
    expect(r.kind).toBe('wake');
    expect(g.lives).toBe(START_LIVES);
    const scared = generateLevel(INTRO.scared).cats.find((c) => c.kind === 'scared')!;
    const g2 = new GameState(generateLevel(INTRO.scared));
    expect(g2.runDir(scared)).toBe((scared.dir + 2) % 4);
  });

  it('spin cats turn a quarter every time a cat leaves', () => {
    const lvl = generateLevel(INTRO.spin);
    const spin = lvl.cats.find((c) => c.kind === 'spin')!;
    const g = new GameState(lvl);
    expect(g.runDir(spin)).toBe(spin.dir);
    const h = g.hint();
    if (h.kind === 'move' && h.cat.id !== spin.id) {
      g.tap(h.cat.x, h.cat.y);
      expect(g.runDir(spin)).toBe((spin.dir + 1) % 4);
      g.undo();
      expect(g.runDir(spin)).toBe(spin.dir);
    }
  });
});
