/** 0 = up, 1 = right, 2 = down, 3 = left */
export type Dir = 0 | 1 | 2 | 3;

export const DX: readonly number[] = [0, 1, 0, -1];
export const DY: readonly number[] = [-1, 0, 1, 0];

/**
 * normal: runs the way it faces.
 * sleepy: curled up, direction hidden until tapped awake (waking is free).
 * scared: runs backwards, away from the way it faces.
 * spin:   turns 90° clockwise every few seconds; runs the way it faces at the moment of the tap.
 */
export type CatKind = 'normal' | 'sleepy' | 'scared' | 'spin';

export interface Cat {
  id: number;
  x: number;
  y: number;
  /** The way the cat looks (for spin cats: the starting direction). */
  dir: Dir;
  /** Index into the cat colour palette. */
  coat: number;
  kind?: CatKind;
}

/** Direction the cat actually runs when tapped (spin cats: at their starting rotation). */
export function exitDir(c: Cat): Dir {
  return c.kind === 'scared' ? (((c.dir + 2) % 4) as Dir) : c.dir;
}

export interface Level {
  number: number;
  w: number;
  h: number;
  /** Row-major; true where the board has a cushion tile. Cats only sit on active cells. */
  mask: boolean[];
  cats: Cat[];
  kind: 'tutorial' | 'easy' | 'normal' | 'hard' | 'boss' | 'daily';
  /** Seconds, or null for untimed levels. */
  timeLimit: number | null;
  /** Seconds between quarter turns of spin cats. */
  spinPeriod: number;
}

export const idx = (w: number, x: number, y: number): number => y * w + x;
