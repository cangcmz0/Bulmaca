import { firstBlocker, freeCats, occupancy } from './solver';
import { Cat, DX, DY, Dir, Level, exitDir, idx } from './types';

export const START_LIVES = 3;

export type TapResult =
  | { kind: 'none' }
  | { kind: 'wake'; cat: Cat }
  | { kind: 'exit'; cat: Cat; dir: Dir }
  | { kind: 'bump'; cat: Cat; dir: Dir; blocker: Cat; /** cells the cat travels before hitting */ steps: number };

/** Pure game rules, no rendering. The renderer animates whatever this returns. */
export class GameState {
  readonly level: Level;
  cats: Map<number, Cat>;
  lives = START_LIVES;
  mistakes = 0;
  readonly total: number;
  /** Seconds left on timed levels, null when untimed. */
  timeLeft: number | null;
  /** Ids of sleepy cats that have not been woken yet. */
  asleep: Set<number>;
  /** Play time that drives spin cats; only advances while the board is live. */
  spinClock = 0;

  constructor(level: Level) {
    this.level = level;
    this.cats = new Map(level.cats.map((c) => [c.id, { ...c }]));
    this.total = level.cats.length;
    this.timeLeft = level.timeLimit;
    this.asleep = new Set(level.cats.filter((c) => c.kind === 'sleepy').map((c) => c.id));
  }

  /** Quarter turns a spin cat has made so far, as a float (for smooth drawing). */
  spinTurns(): number {
    return this.spinClock / this.level.spinPeriod;
  }

  /** The direction this cat would run if tapped right now. */
  runDir(c: Cat): Dir {
    if (c.kind === 'spin') return ((c.dir + Math.floor(this.spinTurns())) % 4) as Dir;
    return exitDir(c);
  }

  advance(dt: number): void {
    if (!this.won && !this.lost) this.spinClock += dt;
  }

  wakeAll(): Cat[] {
    const woken = [...this.asleep].map((id) => this.cats.get(id)).filter((c): c is Cat => !!c);
    this.asleep.clear();
    return woken;
  }

  get won(): boolean {
    return this.cats.size === 0;
  }

  get loseReason(): 'lives' | 'time' | null {
    if (this.won) return null;
    if (this.lives <= 0) return 'lives';
    if (this.timeLeft !== null && this.timeLeft <= 0) return 'time';
    return null;
  }

  get lost(): boolean {
    return this.loseReason !== null;
  }

  /** Advances the clock; returns true on the tick the time runs out. */
  tick(dt: number): boolean {
    if (this.timeLeft === null || this.lost || this.won) return false;
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    return this.timeLeft === 0;
  }

  addTime(seconds: number): void {
    if (this.timeLeft !== null) this.timeLeft += seconds;
  }

  catAt(x: number, y: number): Cat | undefined {
    for (const c of this.cats.values()) if (c.x === x && c.y === y) return c;
    return undefined;
  }

  tap(x: number, y: number): TapResult {
    if (this.won || this.lost) return { kind: 'none' };
    const cat = this.catAt(x, y);
    if (!cat) return { kind: 'none' };
    if (this.asleep.has(cat.id)) {
      this.asleep.delete(cat.id);
      return { kind: 'wake', cat };
    }
    const { w, h } = this.level;
    const list = [...this.cats.values()];
    const grid = occupancy(w, h, list);
    const dir = this.runDir(cat);
    const blockerId = firstBlocker(w, h, grid, cat, dir);
    if (blockerId === -1) {
      this.cats.delete(cat.id);
      return { kind: 'exit', cat, dir };
    }
    const blocker = this.cats.get(blockerId)!;
    const steps = Math.abs(blocker.x - cat.x) + Math.abs(blocker.y - cat.y) - 1;
    this.lives--;
    this.mistakes++;
    return { kind: 'bump', cat, dir, blocker, steps };
  }

  /** A cat that can leave right now (any free cat is always a safe move). */
  hint(): Cat | undefined {
    const free = freeCats(this.level.w, this.level.h, [...this.cats.values()]);
    if (free.length === 0) return undefined;
    // Prefer the free cat that unblocks the most others, it feels like a smarter hint.
    const { w, h } = this.level;
    let best = free[0];
    let bestScore = -Infinity;
    for (const f of free) {
      // Spin cats make you wait, so a hint points at them only when nothing else is free.
      let score = f.kind === 'spin' ? -100 : 0;
      for (const c of this.cats.values()) {
        if (c.id === f.id) continue;
        const d = exitDir(c);
        let x = c.x + DX[d], y = c.y + DY[d];
        while (x >= 0 && y >= 0 && x < w && y < h) {
          const o = [...this.cats.values()].find((k) => k.x === x && k.y === y);
          if (o) { if (o.id === f.id) score++; break; }
          x += DX[d]; y += DY[d];
        }
      }
      if (score > bestScore) { bestScore = score; best = f; }
    }
    return best;
  }

  addLife(n = 1): void {
    this.lives += n;
  }

  stars(): number {
    return Math.max(1, 3 - this.mistakes);
  }

  isActive(x: number, y: number): boolean {
    const { w, h, mask } = this.level;
    return x >= 0 && y >= 0 && x < w && y < h && mask[idx(w, x, y)];
  }
}
