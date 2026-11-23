import { dirAt, findSolution, firstBlocker, freeCats, occupancy } from './solver';
import { Cat, Dir, Level, idx } from './types';

export const START_LIVES = 3;

export type TapResult =
  | { kind: 'none' }
  | { kind: 'wake'; cat: Cat }
  | { kind: 'exit'; cat: Cat; dir: Dir }
  | { kind: 'bump'; cat: Cat; dir: Dir; blocker: Cat; /** cells the cat travels before hitting */ steps: number };

export type HintResult = { kind: 'move'; cat: Cat } | { kind: 'doomed' };

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
  /** Cats that left, in order. Its length is how many quarter turns spin cats have made. */
  history: Cat[] = [];

  constructor(level: Level) {
    this.level = level;
    this.cats = new Map(level.cats.map((c) => [c.id, { ...c }]));
    this.total = level.cats.length;
    this.timeLeft = level.timeLimit;
    this.asleep = new Set(level.cats.filter((c) => c.kind === 'sleepy').map((c) => c.id));
  }

  get exits(): number {
    return this.history.length;
  }

  /** The direction this cat would run if tapped right now. */
  runDir(c: Cat): Dir {
    return dirAt(c, this.exits);
  }

  wakeAll(): Cat[] {
    const woken = [...this.asleep].map((id) => this.cats.get(id)).filter((c): c is Cat => !!c);
    this.asleep.clear();
    return woken;
  }

  get won(): boolean {
    return this.cats.size === 0;
  }

  /** No cat can leave right now. Spin cats only turn when a cat leaves, so this is final. */
  get stuck(): boolean {
    return !this.won && this.free().length === 0;
  }

  get loseReason(): 'lives' | 'time' | 'stuck' | null {
    if (this.won) return null;
    if (this.lives <= 0) return 'lives';
    if (this.timeLeft !== null && this.timeLeft <= 0) return 'time';
    if (this.stuck) return 'stuck';
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

  free(): Cat[] {
    return freeCats(this.level.w, this.level.h, [...this.cats.values()], this.exits);
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
    const grid = occupancy(w, h, [...this.cats.values()]);
    const dir = this.runDir(cat);
    const blockerId = firstBlocker(w, h, grid, cat, dir);
    if (blockerId === -1) {
      this.cats.delete(cat.id);
      this.history.push(cat);
      return { kind: 'exit', cat, dir };
    }
    const blocker = this.cats.get(blockerId)!;
    const steps = Math.abs(blocker.x - cat.x) + Math.abs(blocker.y - cat.y) - 1;
    this.lives--;
    this.mistakes++;
    return { kind: 'bump', cat, dir, blocker, steps };
  }

  /** Puts the last cat that left back on the board (spin cats turn back with it). */
  undo(): Cat | undefined {
    const cat = this.history.pop();
    if (cat) this.cats.set(cat.id, cat);
    return cat;
  }

  /**
   * A move that keeps the level winnable, or 'doomed' when the current position can no longer
   * be won (the player has to undo). If the search runs out of budget, falls back to any free cat.
   */
  hint(): HintResult {
    const { w, h } = this.level;
    const list = [...this.cats.values()];
    const res = findSolution(w, h, list, this.exits);
    if (res.path && res.path.length > 0) return { kind: 'move', cat: this.cats.get(res.path[0])! };
    if (res.complete) return { kind: 'doomed' };
    const free = this.free();
    return free.length ? { kind: 'move', cat: free[0] } : { kind: 'doomed' };
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
