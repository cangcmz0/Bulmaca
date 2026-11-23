import { Rng } from './rng';
import { Cat, Dir, DX, DY, idx } from './types';

/** Builds an occupancy grid: cell index -> cat id, or -1. */
export function occupancy(w: number, h: number, cats: readonly Cat[]): Int32Array {
  const g = new Int32Array(w * h).fill(-1);
  for (const c of cats) g[idx(w, c.x, c.y)] = c.id;
  return g;
}

/** First cat met walking from (x, y) in direction d, or -1 if the way to the edge is clear. */
export function rayBlocker(w: number, h: number, grid: Int32Array, x0: number, y0: number, d: Dir): number {
  let x = x0 + DX[d];
  let y = y0 + DY[d];
  while (x >= 0 && y >= 0 && x < w && y < h) {
    const o = grid[idx(w, x, y)];
    if (o !== -1) return o;
    x += DX[d];
    y += DY[d];
  }
  return -1;
}

/**
 * Direction a cat runs after `exits` cats have left the board.
 * Spin cats turn a quarter clockwise every time any cat leaves, so for them the order of moves
 * matters: that is what turns "find a free cat" into a real planning puzzle.
 */
export function dirAt(c: Cat, exits: number): Dir {
  if (c.kind === 'scared') return ((c.dir + 2) % 4) as Dir;
  if (c.kind === 'spin') return ((c.dir + exits) % 4) as Dir;
  return c.dir;
}

/** Returns the id of the first cat in this cat's path, or -1 if the way out is clear. */
export function firstBlocker(w: number, h: number, grid: Int32Array, cat: Cat, dir: Dir = dirAt(cat, 0)): number {
  return rayBlocker(w, h, grid, cat.x, cat.y, dir);
}

export function freeCats(w: number, h: number, cats: readonly Cat[], exits = 0): Cat[] {
  const grid = occupancy(w, h, cats);
  return cats.filter((c) => firstBlocker(w, h, grid, c, dirAt(c, exits)) === -1);
}

export interface SolveResult {
  solvable: boolean;
  /** Number of "waves": rounds where every free cat leaves at once. Higher = deeper puzzle. */
  depth: number;
  /** How many cats are blocked at the start. */
  blockedAtStart: number;
}

/**
 * Greedy peeling for boards without spin cats: removing a free cat only ever clears paths, so
 * this is an exact solvability test there. Boards with spin cats need findSolution().
 */
export function solve(w: number, h: number, cats: readonly Cat[]): SolveResult {
  const grid = occupancy(w, h, cats);
  let remaining = cats.slice();
  let depth = 0;
  let blockedAtStart = 0;
  while (remaining.length > 0) {
    const free = remaining.filter((c) => firstBlocker(w, h, grid, c) === -1);
    if (depth === 0) blockedAtStart = remaining.length - free.length;
    if (free.length === 0) return { solvable: false, depth, blockedAtStart };
    for (const c of free) grid[idx(w, c.x, c.y)] = -1;
    const freeIds = new Set(free.map((c) => c.id));
    remaining = remaining.filter((c) => !freeIds.has(c.id));
    depth++;
  }
  return { solvable: true, depth, blockedAtStart };
}

/** Greedy wave order as one flat sequence of cat ids (boards without spin cats). */
export function greedyOrder(w: number, h: number, cats: readonly Cat[]): number[] {
  const grid = occupancy(w, h, cats);
  let remaining = cats.slice();
  const order: number[] = [];
  while (remaining.length > 0) {
    const free = remaining.filter((c) => firstBlocker(w, h, grid, c) === -1);
    if (free.length === 0) break;
    for (const c of free) { grid[idx(w, c.x, c.y)] = -1; order.push(c.id); }
    const ids = new Set(free.map((c) => c.id));
    remaining = remaining.filter((c) => !ids.has(c.id));
  }
  return order;
}

export interface Search {
  /** Cat ids in a winning order, or null. */
  path: number[] | null;
  /** False when the node budget ran out before the search could finish. */
  complete: boolean;
}

/**
 * Depth-first search for a winning order, starting after `exits0` cats have already left.
 * Once no spin cats remain the rest is solved greedily (order no longer matters), so the search
 * only branches while spin cats are on the board. Failed states are memoised.
 */
export function findSolution(w: number, h: number, cats: readonly Cat[], exits0 = 0, limit = 30000): Search {
  const n = cats.length;
  const grid = new Int32Array(w * h).fill(-1);
  cats.forEach((c, i) => (grid[idx(w, c.x, c.y)] = i));
  const alive = new Uint8Array(n).fill(1);
  let spinsLeft = cats.filter((c) => c.kind === 'spin').length;
  const failed = new Set<string>();
  const order: number[] = [];
  let nodes = 0;
  let outOfBudget = false;

  const freeAt = (i: number, exits: number) =>
    rayBlocker(w, h, grid, cats[i].x, cats[i].y, dirAt(cats[i], exits)) === -1;

  const rec = (left: number, exits: number): boolean => {
    if (left === 0) return true;
    if (spinsLeft === 0) {
      const rest: number[] = [];
      for (let i = 0; i < n; i++) if (alive[i]) rest.push(i);
      const sub = greedyOrder(w, h, rest.map((i) => ({ ...cats[i], id: i })));
      if (sub.length !== rest.length) return false;
      order.push(...sub);
      return true;
    }
    if (++nodes > limit) { outOfBudget = true; return false; }
    const key = String.fromCharCode(...alive);
    if (failed.has(key)) return false;
    // Cats lying anywhere on another cat's path (for spin cats: on any of their four rays).
    const onPath = new Map<number, number>();
    const walk = (x0: number, y0: number, d: Dir) => {
      let x = x0 + DX[d], y = y0 + DY[d];
      while (x >= 0 && y >= 0 && x < w && y < h) {
        const o = grid[idx(w, x, y)];
        if (o !== -1) onPath.set(o, (onPath.get(o) ?? 0) + 1);
        x += DX[d]; y += DY[d];
      }
    };
    for (let j = 0; j < n; j++) {
      if (!alive[j]) continue;
      const c = cats[j];
      if (c.kind === 'spin') for (let d = 0 as Dir; d < 4; d = (d + 1) as Dir) walk(c.x, c.y, d);
      else walk(c.x, c.y, dirAt(c, 0));
    }
    // Spin cats in their window first, then plain cats. A free plain cat that lies on nobody's
    // path stays free and can never block anyone, so all such cats are interchangeable "wait"
    // moves whose only effect is turning the spinners. Trying one of them is enough: the pruning
    // is exact and keeps the search small.
    const cand: number[] = [];
    for (let i = 0; i < n; i++) if (alive[i] && cats[i].kind === 'spin' && freeAt(i, exits)) cand.push(i);
    let token = -1;
    const plain: number[] = [];
    for (let i = 0; i < n; i++) {
      if (!alive[i] || cats[i].kind === 'spin' || !freeAt(i, exits)) continue;
      if (onPath.has(i)) plain.push(i);
      else if (token === -1) token = i;
    }
    // Clear the cats in the most paths first: that opens the board fastest.
    plain.sort((a, b) => onPath.get(b)! - onPath.get(a)!);
    cand.push(...plain);
    if (token !== -1) cand.push(token);
    for (const i of cand) {
      const cell = idx(w, cats[i].x, cats[i].y);
      alive[i] = 0; grid[cell] = -1; order.push(i);
      if (cats[i].kind === 'spin') spinsLeft--;
      if (rec(left - 1, exits + 1)) return true;
      if (cats[i].kind === 'spin') spinsLeft++;
      alive[i] = 1; grid[cell] = i; order.pop();
      if (outOfBudget) return false;
    }
    failed.add(key);
    return false;
  };

  const ok = rec(n, exits0);
  return { path: ok ? order.map((i) => cats[i].id) : null, complete: ok || !outOfBudget };
}

/**
 * Plays the board like a player who taps random free cats. Returns true if it got every cat
 * out, false if it got stuck. Run many times, the stuck rate measures how much thinking a
 * board demands.
 */
export function randomPlayout(w: number, h: number, cats: readonly Cat[], rng: Rng): boolean {
  const grid = occupancy(w, h, cats);
  const alive = cats.slice();
  let exits = 0;
  while (alive.length > 0) {
    const free: number[] = [];
    for (let i = 0; i < alive.length; i++) {
      const c = alive[i];
      if (firstBlocker(w, h, grid, c, dirAt(c, exits)) === -1) free.push(i);
    }
    if (free.length === 0) return false;
    const k = free[rng.int(free.length)];
    grid[idx(w, alive[k].x, alive[k].y)] = -1;
    alive.splice(k, 1);
    exits++;
  }
  return true;
}

export function stuckRate(w: number, h: number, cats: readonly Cat[], rng: Rng, runs = 24): number {
  let stuck = 0;
  for (let i = 0; i < runs; i++) if (!randomPlayout(w, h, cats, rng)) stuck++;
  return stuck / runs;
}
