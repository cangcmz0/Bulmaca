/** 0 = up, 1 = right, 2 = down, 3 = left */
export type Dir = 0 | 1 | 2 | 3;

export const DX: readonly number[] = [0, 1, 0, -1];
export const DY: readonly number[] = [-1, 0, 1, 0];

export interface Cat {
  id: number;
  x: number;
  y: number;
  dir: Dir;
  /** Index into the cat colour palette. */
  coat: number;
}

export interface Level {
  number: number;
  w: number;
  h: number;
  /** Row-major; true where the board has a cushion tile. Cats only sit on active cells. */
  mask: boolean[];
  cats: Cat[];
}

export const idx = (w: number, x: number, y: number): number => y * w + x;
