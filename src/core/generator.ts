import { Rng, hashSeed } from './rng';
import { dirAt, firstBlocker, greedyOrder, occupancy, solve, stuckRate } from './solver';
import { Cat, CatKind, Dir, DX, DY, Level, idx } from './types';

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
  /** Added to the base number of cats allowed to be free at the start. */
  free: number;
}

/** The game's official level count. Difficulty is tuned to keep rising all the way to here. */
export const TOTAL_LEVELS = 40000;

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
 * Difficulty rises on a log scale across all 8000 levels: quick growth early (board size hits the
 * phone cap around level 150), then a slow, steady squeeze, with deeper chains and tighter clocks,
 * that only peaks at the final level. Levels past 8000 keep generating at peak difficulty.
 */
export function paramsFor(n: number): Params {
  const kind = kindFor(n);
  const g = Math.log2(1 + n / 5); // 0 at the start, ~5 at level 155, ~10 at level 5000
  let size = 4 + Math.floor(g);
  let fill = Math.min(0.93, 0.62 + 0.06 * Math.log2(1 + n / 3));
  const m = Math.min(n, TOTAL_LEVELS);
  // Every level after the two tutorials gets hardened: no more "tap anything and win" boards.
  let harden = n < 3 ? 0 : Math.min(4000, Math.round(60 + 12 * n));
  let secPerCat = 0;
  // 0.39 at level 3, 0.44 at 20, 0.50 at 100, 0.60 at 1000, 0.76 at 40000
  let chain = 0.36 + 0.031 * Math.log2(1 + m / 5);
  let free = 0; // extra allowance of cats that can leave at the very start

  if (kind === 'easy') {
    size -= 1;
    fill -= 0.1;
    harden = Math.round(harden * 0.3);
    chain -= 0.1;
    free = 2;
  } else if (kind === 'hard') {
    size += 1;
    fill += 0.04;
    harden = Math.round(harden * 2 + 200);
    chain += 0.12;
    free = -1;
  } else if (kind === 'boss') {
    size += 1;
    fill += 0.06;
    harden = Math.round(harden * 3 + 400);
    chain += 0.18;
    free = -1;
  }

  // Timers start once players know the game and tighten until the last level: 4.2 s per cat at
  // the start, ~2.9 s at level 1000, 1.6 s at level 40000.
  const tight = 4.2 - 0.25 * Math.log2(1 + m / 30);
  if ((kind === 'hard' || kind === 'boss') && n >= 20) secPerCat = kind === 'boss' ? tight * 1.15 : tight;
  else if (kind === 'normal' && n >= 150) secPerCat = tight * 1.6;

  const w = Math.max(4, Math.min(MAX_W, size));
  const h = Math.max(5, Math.min(MAX_H, size + 1 + (n >= 100 ? 1 : 0)));
  return {
    w, h,
    fill: Math.min(0.95, Math.max(0.45, fill)),
    shaped: n >= 15 && kind !== 'boss' && hashSeed(n, 7) % 3 !== 0,
    harden, kind, secPerCat, free,
    chain: Math.max(0.12, Math.min(0.9, chain)),
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

interface Goal {
  /** Target number of waves. */
  depth: number;
  /** Most cats that may be free at the start. */
  free: number;
}

/**
 * Puzzle quality. In order of weight:
 *  1. hit the target depth (how long the "this one first" chains are),
 *  2. few cats free at the start, so the first move already needs looking,
 *  3. blockers far away, since a cat blocked from across the board is easy to miss.
 */
function score(w: number, h: number, cats: Cat[], goal: Goal): { sc: number; hit: boolean } {
  const r = solve(w, h, cats);
  if (!r.solvable) return { sc: -Infinity, hit: false };
  const free0 = cats.length - r.blockedAtStart;
  const off = Math.abs(r.depth - goal.depth);
  const overFree = Math.max(0, free0 - goal.free);
  const grid = occupancy(w, h, cats);
  let dist = 0, blocked = 0;
  for (const c of cats) {
    const b = firstBlocker(w, h, grid, c);
    if (b === -1) continue;
    const o = cats[b] && cats[b].id === b ? cats[b] : cats.find((k) => k.id === b)!;
    dist += Math.abs(o.x - c.x) + Math.abs(o.y - c.y);
    blocked++;
  }
  const avgDist = blocked ? dist / blocked : 0;
  return { sc: -off * 10 - overFree * 4 + Math.min(avgDist, 5) * 0.6, hit: off === 0 && overFree === 0 };
}

/**
 * Hill climb: turn one cat to a new direction, keep the change if the board stays solvable and
 * scores at least as well. Once the goal is met, a short polish phase keeps improving the
 * long-range blocks without leaving the goal.
 */
function harden(rng: Rng, w: number, h: number, mask: boolean[], cats: Cat[], budget: number, goal: Goal): Cat[] {
  if (budget <= 0 || cats.length < 3) return cats;
  let cur = cats.map((c) => ({ ...c }));
  let curScore = score(w, h, cur, goal);
  let polish = Math.min(200, Math.round(budget * 0.25));
  for (let i = 0; i < budget; i++) {
    if (curScore.hit && polish-- <= 0) break;
    const k = rng.int(cur.length);
    const c = cur[k];
    const dir = ((c.dir + 1 + rng.int(3)) % 4) as Dir;
    // Facing straight off the board makes a trivially free cat; mostly skip those.
    const nx = c.x + DX[dir], ny = c.y + DY[dir];
    if ((nx < 0 || ny < 0 || nx >= w || ny >= h || !mask[idx(w, nx, ny)]) && rng.next() < 0.8) continue;
    const next = cur.slice();
    next[k] = { ...c, dir };
    const sc = score(w, h, next, goal);
    if (sc.sc >= curScore.sc && (sc.hit || !curScore.hit)) { cur = next; curScore = sc; }
  }
  return cur;
}

/** Level where each special cat first appears (a normal level, never a boss). */
export const INTRO: Record<Exclude<CatKind, 'normal'>, number> = { spin: 8, sleepy: 15, scared: 25 };

/** How many of each special cat a level gets. Shares grow slowly to the last level. */
export function specialsFor(n: number, kind: LevelKind, cats: number): Record<Exclude<CatKind, 'normal'>, number> {
  const m = Math.min(n, TOTAL_LEVELS);
  const intro = { sleepy: 0, scared: 0, spin: 0 };
  if (n === INTRO.spin) return { ...intro, spin: 2 };
  if (n === INTRO.sleepy) return { ...intro, sleepy: 3, spin: 2 };
  if (n === INTRO.scared) return { ...intro, scared: 3, spin: 3 };
  const k = kind === 'easy' ? 0.5 : kind === 'hard' ? 1.2 : kind === 'boss' ? 1.35 : 1;
  const share = (start: number, base: number, slope: number, cap: number) =>
    n < start ? 0 : Math.min(cap, (base + slope * Math.log2(1 + m / start)) * k);
  const sleepy = Math.round(cats * share(INTRO.sleepy, 0.07, 0.03, 0.28));
  const scared = Math.round(cats * share(INTRO.scared, 0.05, 0.025, 0.22));
  // Spin cats carry the planning part of the puzzle, so they grow fastest.
  let spin = 0;
  if (n > INTRO.spin) {
    spin = 2 + Math.floor(1.3 * Math.log2(1 + m / INTRO.spin));
    if (kind === 'easy') spin = Math.max(1, Math.floor(spin / 2));
    if (kind === 'hard') spin += 1;
    if (kind === 'boss') spin += 2;
  }
  return { sleepy, scared, spin: Math.min(spin, 14, Math.floor(cats * 0.3)) };
}

/** Share of random-tapping players that should get stuck: how much planning a level demands. */
export function stuckTargetFor(n: number, kind: LevelKind): number {
  const m = Math.min(n, TOTAL_LEVELS);
  let t = 0.25 + 0.048 * Math.log2(1 + m / INTRO.spin); // 0.30 at 8, 0.6 at ~1300, 0.84 at 40000
  if (kind === 'easy') t -= 0.15;
  if (kind === 'hard') t += 0.08;
  if (kind === 'boss') t += 0.12;
  return Math.max(0.1, Math.min(0.9, t));
}

/**
 * Turns some cats special after the board is built. Scared cats get their gaze flipped so their
 * real escape route is unchanged; spin cats can only get easier to free; sleepy cats only hide
 * information. None of it can make a solvable board unsolvable.
 */
function assignSpecials(rng: Rng, cats: Cat[], counts: Record<Exclude<CatKind, 'normal'>, number>): Cat[] {
  const order = rng.shuffle(cats.map((_, i) => i));
  const out = cats.map((c) => ({ ...c, kind: 'normal' as CatKind }));
  let p = 0;
  for (const kind of ['scared', 'sleepy'] as const) {
    for (let i = 0; i < counts[kind] && p < order.length; i++, p++) {
      const c = out[order[p]];
      c.kind = kind;
      if (kind === 'scared') c.dir = ((c.dir + 2) % 4) as Dir;
    }
  }
  return out;
}

/**
 * Turns `count` plain cats into spin cats while keeping a known winning order: take the greedy
 * order of the finished board; a cat that leaves at step t gets the starting direction that,
 * after t quarter turns, points the way it originally left. That exact order still wins, but
 * most other orders don't. Several picks are tried and the one whose random-play stuck rate is
 * closest to the target is kept.
 */
function addSpinCats(rng: Rng, w: number, h: number, cats: Cat[], count: number, target: number): { cats: Cat[]; stuck: number } {
  if (count <= 0) return { cats, stuck: 0 };
  const order = greedyOrder(w, h, cats);
  const step = new Map(order.map((id, t) => [id, t]));
  const spin = (list: Cat[], id: number): Cat[] => list.map((c) => {
    if (c.id !== id) return c;
    const t = step.get(c.id)!;
    return { ...c, kind: 'spin' as CatKind, dir: ((((c.dir - t) % 4) + 4) % 4) as Dir };
  });
  // Greedy pick: each new spin cat is the candidate that makes random play get stuck most often.
  let cur = cats;
  let curStuck = 0;
  for (let slot = 0; slot < count; slot++) {
    // Best spin cats are the ones standing in many others' way: when such a cat is turned the
    // wrong way, everyone behind it waits, and a wrong order strands the whole group.
    const grid = occupancy(w, h, cur);
    const blocks = new Map<number, number>();
    for (const c of cur) {
      const b = firstBlocker(w, h, grid, c, dirAt(c, 0));
      if (b !== -1) blocks.set(b, (blocks.get(b) ?? 0) + 1);
    }
    const pool = cur.filter((c) => (c.kind ?? 'normal') === 'normal')
      .sort((a, b) => (blocks.get(b.id) ?? 0) - (blocks.get(a.id) ?? 0) || rng.next() - 0.5);
    const plain = rng.shuffle(pool.slice(0, 8).map((c) => c.id)).slice(0, 5);
    if (plain.length === 0) break;
    let pick = cur, pickStuck = -1;
    for (const id of plain) {
      const next = spin(cur, id);
      const st = stuckRate(w, h, next, rng, 12);
      if (st > pickStuck) { pick = next; pickStuck = st; }
    }
    cur = pick;
    curStuck = pickStuck;
    // Stop early only when clearly past the target (single estimates are noisy).
    if (curStuck >= target + 0.15 && slot >= 1) break;
  }
  return { cats: cur, stuck: stuckRate(w, h, cur, rng, 24) };
}

function goalFor(p: Params, cats: number): Goal {
  return {
    depth: Math.max(2, Math.round(cats * p.chain)),
    free: Math.max(1, Math.min(5, 1 + Math.round(cats / 14) + p.free)),
  };
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
    const sc = score(p.w, p.h, cats, goalFor(p, cats.length)).sc + cats.length * 0.5;
    if (sc > bestScore) { bestScore = sc; best = cats; }
  }
  // Special cats go in before hardening so the climb builds chains around them (a spin cat
  // can leave whichever way is open, which would otherwise shortcut the chains).
  const counts = specialsFor(n, p.kind, best.length);
  best = assignSpecials(new Rng(hashSeed(n, salt, 0x73706563)), best, counts);
  best = harden(new Rng(hashSeed(n, salt, 0x68617264)), p.w, p.h, mask, best, p.harden, goalFor(p, best.length));
  const depth = solve(p.w, p.h, best).depth;
  // A few independent tries; keep the one whose stuck rate lands closest to the target.
  const goalStuck = stuckTargetFor(n, p.kind);
  let spun = addSpinCats(new Rng(hashSeed(n, salt, 0x7370696e)), p.w, p.h, best, counts.spin, goalStuck);
  for (let tryNo = 1; tryNo < 3 && counts.spin > 0 && Math.abs(spun.stuck - goalStuck) > 0.2; tryNo++) {
    const again = addSpinCats(new Rng(hashSeed(n, salt, 0x7370696e, tryNo)), p.w, p.h, best, counts.spin, goalStuck);
    if (Math.abs(again.stuck - goalStuck) < Math.abs(spun.stuck - goalStuck)) spun = again;
  }
  best = spun.cats;
  // Spin cats need thinking time, so each buys a few seconds of clock.
  const extra = counts.spin * 3;
  const timeLimit = p.secPerCat > 0 ? Math.max(15, Math.round((best.length * p.secPerCat + extra) / 5) * 5) : null;
  return { number: n, w: p.w, h: p.h, mask, cats: best, kind: p.kind, timeLimit, meta: { depth, stuckRate: spun.stuck } };
}

/** Daily puzzle: same board for everyone on a given UTC day. */
export function dailyLevel(date: Date): Level {
  const key = date.getUTCFullYear() * 10000 + (date.getUTCMonth() + 1) * 100 + date.getUTCDate();
  const lvl = generateLevel(80, key);
  return { ...lvl, number: -1, kind: 'daily', timeLimit: null };
}
