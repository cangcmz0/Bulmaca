export interface SaveData {
  level: number;
  stars: Record<number, number>;
  hints: number;
  sound: boolean;
  noAds: boolean;
  /** YYYY-MM-DD of the last solved daily puzzle */
  dailyDone: string | null;
  streak: number;
  levelsSinceAd: number;
}

const KEY = 'kedi-kacisi-save-v1';

const DEFAULTS: SaveData = {
  level: 1,
  stars: {},
  hints: 3,
  sound: true,
  noAds: false,
  dailyDone: null,
  streak: 0,
  levelsSinceAd: 0,
};

export function load(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<SaveData>) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function save(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* private mode or storage blocked: progress stays in memory */
  }
}

export function todayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function yesterdayKey(d = new Date()): string {
  return todayKey(new Date(d.getTime() - 86400000));
}
