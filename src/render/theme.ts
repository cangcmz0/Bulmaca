export interface Theme {
  bgTop: string;
  bgBottom: string;
  board: string;
  tileA: string;
  tileB: string;
  tileEdge: string;
  ink: string;
  accent: string;
}

/** One room per 20 levels; cycling rooms keeps long sessions feeling fresh for free. */
export const THEMES: Theme[] = [
  { bgTop: '#ffeedd', bgBottom: '#ffd2b3', board: '#e9b48b', tileA: '#fff6ec', tileB: '#ffe7d2', tileEdge: '#d79a6e', ink: '#5a3d33', accent: '#ff7b54' },
  { bgTop: '#e6f7dc', bgBottom: '#bfe5a8', board: '#93c77e', tileA: '#f5fcee', tileB: '#e3f4d4', tileEdge: '#72a95f', ink: '#34502b', accent: '#ff8a3d' },
  { bgTop: '#3a4179', bgBottom: '#1f2450', board: '#555ea3', tileA: '#eeeaff', tileB: '#ddd7fb', tileEdge: '#3f4689', ink: '#fff6e8', accent: '#ffcf4a' },
  { bgTop: '#e2f7f3', bgBottom: '#b8e6de', board: '#7ccbbf', tileA: '#f4fffd', tileB: '#e0f6f2', tileEdge: '#5aaea2', ink: '#24504a', accent: '#ff6f61' },
  { bgTop: '#ffe9f2', bgBottom: '#f8c6db', board: '#e79bbb', tileA: '#fff5f9', tileB: '#ffe3ee', tileEdge: '#cd7c9f', ink: '#5b2e43', accent: '#7c5cff' },
];

export function themeFor(level: number): Theme {
  if (level < 1) return THEMES[2]; // daily puzzle: night room
  return THEMES[Math.floor((level - 1) / 20) % THEMES.length];
}

export function applyTheme(theme: Theme): void {
  const r = document.documentElement.style;
  r.setProperty('--bg-top', theme.bgTop);
  r.setProperty('--bg-bottom', theme.bgBottom);
  r.setProperty('--ink', theme.ink);
  r.setProperty('--accent', theme.accent);
  r.setProperty('--board', theme.board);
}
