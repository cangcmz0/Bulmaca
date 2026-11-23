import { Cat, Dir, DX, DY, exitDir, idx } from './types';

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

/** Returns the id of the first cat in this cat's path, or -1 if the way out is clear. */
export function firstBlocker(w: number, h: number, grid: Int32Array, cat: Cat, dir: Dir = exitDir(cat)): number {
  return rayBlocker(w, h, grid, cat.x, cat.y, dir);
}

/**
 * Can this cat leave at some point given the current board? Spin cats only need one clear side,
 * since the player can wait for it to turn that way. Leaving only ever clears paths, so this
 * stays an exact, greedy solvability test with every cat kind.
 */
export function canLeave(w: number, h: number, grid: Int32Array, cat: Cat): boolean {
  if (cat.kind === 'spin') {
    for (let d = 0 as Dir; d < 4; d = (d + 1) as Dir) if (rayBlocker(w, h, grid, cat.x, cat.y, d) === -1) return true;
    return false;
  }
  return firstBlocker(w, h, grid, cat) === -1;
}

export interface SolveResult {
  solvable: boolean;
  /** Number of "waves": rounds where every free cat leaves at once. Higher = deeper puzzle. */
  depth: number;
  /** How many cats are blocked at the start. */
  blockedAtStart: number;
}

/**
 * Removing a free cat only ever clears paths, so greedy peeling is an exact solvability test.
 */
export function solve(w: number, h: number, cats: readonly Cat[]): SolveResult {
  const grid = occupancy(w, h, cats);
  let remaining = cats.slice();
  let depth = 0;
  let blockedAtStart = 0;
  while (remaining.length > 0) {
    const free = remaining.filter((c) => canLeave(w, h, grid, c));
    if (depth === 0) blockedAtStart = remaining.length - free.length;
    if (free.length === 0) return { solvable: false, depth, blockedAtStart };
    for (const c of free) grid[idx(w, c.x, c.y)] = -1;
    const freeIds = new Set(free.map((c) => c.id));
    remaining = remaining.filter((c) => !freeIds.has(c.id));
    depth++;
  }
  return { solvable: true, depth, blockedAtStart };
}

export function freeCats(w: number, h: number, cats: readonly Cat[]): Cat[] {
  const grid = occupancy(w, h, cats);
  return cats.filter((c) => canLeave(w, h, grid, c));
}
