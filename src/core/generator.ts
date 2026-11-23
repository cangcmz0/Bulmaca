import { Rng, hashSeed } from './rng';
import { solve } from './solver';
import { Cat, Dir, DX, DY, Level, idx } from './types';

export const COAT_COUNT = 6;

export type LevelKind = 'tutorial' | 'easy' | 'normal' | 'hard' | 'boss' | 'daily';

interface Params {
  w: number;
  h: number;
  fill: number;
  shaped: boolean;
  /** Hill-climb mutations spent making the board deeper. 0 = leave the random board as is. */
  harden: number;
  kind: LevelKind;
  /** Seconds per cat for timed levels, or 0 for no timer. */
  secPerCat: number;
  /**
   * Target depth / cats. 0.2 means many cats can leave at any moment (easy to spot a move);
   * 0.8 means nearly a single chain where only one or two cats are free at a time.
   */
  chain: number;
}

/** Largest board that still reads well on a phone held upright. */
export const MAX_W = 9;
export const MAX_H = 11;

/**
 * Each block of 10 levels follows a sawtooth: a breather, normal levels, two hard spikes and a
 * boss at the end. Spikes are where players fail and reach for "continue" ads; the easy level
 * right before the boss keeps them from quitting.
 */
const PATTERN: LevelKind[] = ['normal', 'normal', 'normal', 'hard', 'normal', 'normal', 'hard', 'normal', 'easy', 'boss'];

export function kindFor(n: number): LevelKind {
  if (n <= 2) return 'tutorial';
  if (n < 10) return n === 7 ? 'hard' : 'normal';
  return PATTERN[(n - 1) % 10];
}

/**
 * Difficulty grows without an upper level limit. Board size grows logarithmically until it hits
 * the phone-size cap, after that the hill climb gets more budget (deeper chains) and timed levels
 * get tighter, so level 5000 is still harder than level 500.
 */
export function paramsFor(n: number): Params {
  const kind = kindFor(n);
  const g = Math.log2(1 + n / 5); // 0 at the start, ~5 at level 155, ~10 at level 5000
  let size = 4 + Math.floor(g);
  let fill = Math.min(0.93, 0.55 + 0.075 * Math.log2(1 + n / 3));
  let harden = n < 6 ? 0 : Math.min(2500, Math.round(12 * n));
  let secPerCat = 0;
  let chain = Math.min(0.66, 0.18 + 0.075 * Math.log2(1 + n / 5));

  if (kind === 'easy') {
    size -= 1;
    fill -= 0.1;
    harden = Math.round(harden * 0.2);
    chain -= 0.1;
  } else if (kind === 'hard') {
    size += 1;
    fill += 0.04;
    harden = Math.round(harden * 2 + 200);
    chain += 0.12;
  } else if (kind === 'boss') {
    size += 1;
    fill += 0.06;
    harden = Math.round(harden * 3 + 400);
    chain += 0.2;
  }

  // Timers start once players know the game; they tighten slowly forever, with a fair floor.
  const tight = Math.max(1.7, 4.2 - 0.45 * Math.log2(1 + n / 30));
  if ((kind === 'hard' || kind === 'boss') && n >= 25) secPerCat = kind === 'boss' ? tight * 1.15 : tight;
  else if (kind === 'normal' && n >= 150) secPerCat = tight * 1.6;

  const w = Math.max(4, Math.min(MAX_W, size));
  const h = Math.max(4, Math.min(MAX_H, size + (n >= 20 ? 1 : 0) + (n >= 100 ? 1 : 0)));
  return {
    w, h,
    fill: Math.min(0.95, Math.max(0.45, fill)),
    shaped: n >= 12 && kind !== 'boss' && hashSeed(n, 7) % 3 !== 0,
    harden, kind, secPerCat,
    chain: Math.max(0.12, Math.min(0.85, chain)),
  };
}

type ShapeFn = (x: number, y: number, w: number, h: number) => boolean;

const SHAPES: ShapeFn[] = [
  // diamond
  (x, y, w, h) => {
    const cx = (w - 1) / 2, cy = (h - 1) / 2;
    return Math.abs(x - cx) / (cx + 0.5) + Math.abs(y - cy) / (cy + 0.5) <= 1.15;
  },
  // circle
  (x, y, w, h) => {
    const cx = (w - 1) / 2, cy = (h - 1) / 2;
    return ((x - cx) / (cx + 0.6)) ** 2 + ((y - cy) / (cy + 0.6)) ** 2 <= 1;
  },
  // plus
  (x, y, w, h) => {
    const bx = Math.max(1, Math.floor(w / 4)), by = Math.max(1, Math.floor(h / 4));
    return (x >= bx && x < w - bx) || (y >= by && y < h - by);
  },
  // heart
  (x, y, w, h) => {
    const u = ((x + 0.5) / w) * 2.4 - 1.2;
    const v = 1.25 - ((y + 0.5) / h) * 2.5;
    const a = u * u + v * v - 1;
    return a * a * a - u * u * v * v * v <= 0.05;
  },
  // hourglass
  (x, y, w, h) => {
    const cx = (w - 1) / 2, cy = (h - 1) / 2;
    return Math.abs(x - cx) <= Math.abs(y - cy) * (w / h) + 1;
  },
  // ring (hole in the middle)
  (x, y, w, h) => {
    const cx = (w - 1) / 2, cy = (h - 1) / 2;
    return !(Math.abs(x - cx) < w / 5 && Math.abs(y - cy) < h / 5);
  },
];

function buildMask(rng: Rng, p: Params): boolean[] {
  const mask = new Array<boolean>(p.w * p.h).fill(true);
  if (!p.shaped) return mask;
  const shape = rng.pick(SHAPES);
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) mask[idx(p.w, x, y)] = shape(x, y, p.w, p.h);
  return mask.filter(Boolean).length >= p.w * p.h * 0.45 ? mask : new Array<boolean>(p.w * p.h).fill(true);
}

/**
 * Reverse construction: cats are placed one by one and each new cat must have a clear way out
 * past the cats already placed. Removing them in reverse placement order always works, so every
 * generated board is solvable. Longer exit rays are preferred because they are more likely to be
 * blocked by cats placed later, which makes the puzzle deeper.
 */
function placeCats(rng: Rng, p: Params, mask: boolean[]): Cat[] {
  const { w, h } = p;
  const grid = new Int32Array(w * h).fill(-1);
  const active: number[] = [];
  mask.forEach((m, i) => m && active.push(i));
  const target = Math.max(2, Math.round(active.length * p.fill));
  const placed: Cat[] = [];

  let progress = true;
  while (progress && placed.length < target) {
    progress = false;
    for (const cell of rng.shuffle(active.slice())) {
      if (placed.length >= target) break;
      if (grid[cell] !== -1) continue;
      const x = cell % w, y = Math.floor(cell / w);
      const options: { dir: Dir; weight: number }[] = [];
      for (let d = 0 as Dir; d < 4; d = (d + 1) as Dir) {
        let cx = x + DX[d], cy = y + DY[d], len = 0, clear = true;
        while (cx >= 0 && cy >= 0 && cx < w && cy < h) {
          if (grid[idx(w, cx, cy)] !== -1) { clear = false; break; }
          if (mask[idx(w, cx, cy)]) len++;
          cx += DX[d]; cy += DY[d];
        }
        if (clear) options.push({ dir: d, weight: (len + 1) ** 2 });
      }
      if (options.length === 0) continue;
      let r = rng.next() * options.reduce((s, o) => s + o.weight, 0);
      let dir = options[0].dir;
      for (const o of options) { r -= o.weight; if (r <= 0) { dir = o.dir; break; } }
      const cat: Cat = { id: placed.length, x, y, dir, coat: rng.int(COAT_COUNT) };
      grid[cell] = cat.id;
      placed.push(cat);
      progress = true;
    }
  }
  // Re-number so ids don't reveal the solution order.
  return rng.shuffle(placed).map((c, i) => ({ ...c, id: i }));
}

function tutorial(n: number): Level | null {
  if (n === 1) {
    // One row of cats all looking right: the front one must go first.
    const w = 3, h = 3;
    const cats: Cat[] = [
      { id: 0, x: 0, y: 1, dir: 1, coat: 0 },
      { id: 1, x: 1, y: 1, dir: 1, coat: 2 },
      { id: 2, x: 2, y: 1, dir: 1, coat: 4 },
    ];
    return { number: n, w, h, mask: new Array(w * h).fill(true), cats, kind: 'tutorial', timeLimit: null };
  }
  if (n === 2) {
    const w = 3, h = 4;
    const cats: Cat[] = [
      { id: 0, x: 1, y: 0, dir: 2, coat: 1 },
      { id: 1, x: 1, y: 2, dir: 3, coat: 3 },
      { id: 2, x: 0, y: 2, dir: 0, coat: 5 },
      { id: 3, x: 2, y: 2, dir: 1, coat: 0 },
      { id: 4, x: 1, y: 3, dir: 3, coat: 2 },
    ];
    return { number: n, w, h, mask: new Array(w * h).fill(true), cats, kind: 'tutorial', timeLimit: null };
  }
  return null;
}

function score(w: number, h: number, cats: Cat[], target: number): { sc: number; hit: boolean } {
  const r = solve(w, h, cats);
  if (!r.solvable) return { sc: -Infinity, hit: false };
  // Hit the target depth first; among equals prefer fewer safe first moves.
  const off = Math.abs(r.depth - target);
  return { sc: -off * 10 + (r.blockedAtStart / Math.max(1, cats.length)) * 3, hit: off === 0 };
}

/**
 * Hill climb: turn one cat to a new direction, keep the change if the board stays solvable and
 * gets closer to the target depth. Turning cats inward builds "this one first, then that one"
 * chains, so the climb can make a board as hard as we ask for.
 */
function harden(rng: Rng, w: number, h: number, mask: boolean[], cats: Cat[], budget: number, target: number): Cat[] {
  if (budget <= 0 || cats.length < 3) return cats;
  let cur = cats.map((c) => ({ ...c }));
  let curScore = score(w, h, cur, target);
  for (let i = 0; i < budget && !curScore.hit; i++) {
    const k = rng.int(cur.length);
    const c = cur[k];
    const dir = ((c.dir + 1 + rng.int(3)) % 4) as Dir;
    // Facing straight off the board makes a trivially free cat; mostly skip those.
    const nx = c.x + DX[dir], ny = c.y + DY[dir];
    if ((nx < 0 || ny < 0 || nx >= w || ny >= h || !mask[idx(w, nx, ny)]) && rng.next() < 0.8) continue;
    const next = cur.slice();
    next[k] = { ...c, dir };
    const sc = score(w, h, next, target);
    if (sc.sc >= curScore.sc) { cur = next; curScore = sc; }
  }
  return cur;
}

export function generateLevel(n: number, salt = 0): Level {
  const t = salt === 0 ? tutorial(n) : null;
  if (t) return t;
  const p = paramsFor(n);
  const base = new Rng(hashSeed(n, 0x6b656469, salt));
  const mask = buildMask(base, p);

  let best: Cat[] = [];
  let bestScore = -Infinity;
  for (let attempt = 0; attempt < 6; attempt++) {
    const rng = new Rng(hashSeed(n, attempt, salt, 0x63617473));
    const cats = placeCats(rng, p, mask);
    const sc = score(p.w, p.h, cats, Math.round(cats.length * p.chain)).sc + cats.length * 0.5;
    if (sc > bestScore) { bestScore = sc; best = cats; }
  }
  const target = Math.max(2, Math.round(best.length * p.chain));
  best = harden(new Rng(hashSeed(n, salt, 0x68617264)), p.w, p.h, mask, best, p.harden, target);
  const timeLimit = p.secPerCat > 0 ? Math.max(15, Math.round((best.length * p.secPerCat) / 5) * 5) : null;
  return { number: n, w: p.w, h: p.h, mask, cats: best, kind: p.kind, timeLimit };
}

/** Daily puzzle: same board for everyone on a given UTC day. */
export function dailyLevel(date: Date): Level {
  const key = date.getUTCFullYear() * 10000 + (date.getUTCMonth() + 1) * 100 + date.getUTCDate();
  const lvl = generateLevel(80, key);
  return { ...lvl, number: -1, kind: 'daily', timeLimit: null };
}
