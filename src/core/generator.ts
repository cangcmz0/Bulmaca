import { Rng, hashSeed } from './rng';
import { solve } from './solver';
import { Cat, Dir, DX, DY, Level, idx } from './types';

export const COAT_COUNT = 6;

interface Params {
  w: number;
  h: number;
  fill: number;
  targetDepth: number;
  shaped: boolean;
}

export function paramsFor(n: number): Params {
  const boss = n >= 20 && n % 10 === 0;
  let p: Params;
  if (n <= 4) p = { w: 4, h: 4, fill: 0.55, targetDepth: 2, shaped: false };
  else if (n <= 10) p = { w: 5, h: 5, fill: 0.65, targetDepth: 3, shaped: false };
  else if (n <= 25) p = { w: 5, h: 6, fill: 0.75, targetDepth: 4, shaped: n % 3 === 0 };
  else if (n <= 50) p = { w: 6, h: 7, fill: 0.82, targetDepth: 5, shaped: n % 3 !== 1 };
  else if (n <= 100) p = { w: 7, h: 8, fill: 0.88, targetDepth: 6, shaped: n % 2 === 0 };
  else p = { w: 8, h: 9, fill: 0.9, targetDepth: 7, shaped: n % 2 === 0 };
  if (boss) {
    p = { ...p, w: p.w + 1, h: p.h + 1, fill: Math.min(0.95, p.fill + 0.05), targetDepth: p.targetDepth + 2 };
  }
  return p;
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
    return { number: n, w, h, mask: new Array(w * h).fill(true), cats };
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
    return { number: n, w, h, mask: new Array(w * h).fill(true), cats };
  }
  return null;
}

export function generateLevel(n: number, salt = 0): Level {
  const t = salt === 0 ? tutorial(n) : null;
  if (t) return t;
  const p = paramsFor(n);
  const base = new Rng(hashSeed(n, 0x6b656469, salt));
  const mask = buildMask(base, p);

  let best: Cat[] = [];
  let bestScore = -Infinity;
  for (let attempt = 0; attempt < 14; attempt++) {
    const rng = new Rng(hashSeed(n, attempt, salt, 0x63617473));
    const cats = placeCats(rng, p, mask);
    const res = solve(p.w, p.h, cats);
    if (!res.solvable) continue; // never expected, but stay safe
    const score =
      -Math.abs(res.depth - p.targetDepth) * 3 +
      (res.blockedAtStart / Math.max(1, cats.length)) * 4 +
      cats.length * 0.05;
    if (score > bestScore) { bestScore = score; best = cats; }
  }
  return { number: n, w: p.w, h: p.h, mask, cats: best };
}

/** Daily puzzle: same board for everyone on a given UTC day. */
export function dailyLevel(date: Date): Level {
  const key = date.getUTCFullYear() * 10000 + (date.getUTCMonth() + 1) * 100 + date.getUTCDate();
  const lvl = generateLevel(60, key);
  return { ...lvl, number: -1 };
}
