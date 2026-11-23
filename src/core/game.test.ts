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

  it('can be finished by always following hints, with no mistakes, with every cat kind', () => {
    for (const n of [3, 17, 33, 55, 84, 120, 777, 7994]) {
      const g = new GameState(generateLevel(n));
      let guard = 5000;
      while (!g.won && guard-- > 0) {
        const c = g.hint()!;
        if (g.asleep.has(c.id)) expect(g.tap(c.x, c.y).kind).toBe('wake');
        // wait for a spin cat to face a clear way, like a player would
        for (let i = 0; i < 4 && c.kind === 'spin'; i++) {
          const grid = [...g.cats.values()];
          const d = g.runDir(c);
          const blocked = grid.some((o) => o.id !== c.id &&
            ((d === 0 && o.x === c.x && o.y < c.y) || (d === 2 && o.x === c.x && o.y > c.y) ||
             (d === 1 && o.y === c.y && o.x > c.x) || (d === 3 && o.y === c.y && o.x < c.x)));
          if (!blocked) break;
          g.advance(g.level.spinPeriod);
        }
        expect(g.tap(c.x, c.y).kind, `level ${g.level.number}`).toBe('exit');
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

  it('sleepy cats wake for free, scared cats run backwards', () => {
    const lvl = generateLevel(31);
    const sleepy = lvl.cats.filter((c) => c.kind === 'sleepy');
    expect(sleepy.length).toBe(3);
    const g = new GameState(lvl);
    const r = g.tap(sleepy[0].x, sleepy[0].y);
    expect(r.kind).toBe('wake');
    expect(g.lives).toBe(START_LIVES);
    const scared = generateLevel(51).cats.find((c) => c.kind === 'scared')!;
    const g2 = new GameState(generateLevel(51));
    expect(g2.runDir(scared)).toBe((scared.dir + 2) % 4);
  });

  it('spin cats turn a quarter every period', () => {
    const lvl = generateLevel(81);
    const spin = lvl.cats.find((c) => c.kind === 'spin')!;
    const g = new GameState(lvl);
    expect(g.runDir(spin)).toBe(spin.dir);
    g.advance(lvl.spinPeriod * 1.01);
    expect(g.runDir(spin)).toBe((spin.dir + 1) % 4);
  });
});
