export interface SaveData {
  level: number;
  stars: Record<number, number>;
  hints: number;
  sound: boolean;
  vibration: boolean;
  music: boolean;
  noAds: boolean;
  /** YYYY-MM-DD of the last solved daily puzzle */
  dailyDone: string | null;
  streak: number;
  levelsSinceAd: number;
  /** Special cat kinds whose intro card has been shown. */
  seenKinds: string[];
  /** YYYY-MM-DD the daily gift was last claimed. */
  giftDay: string | null;
  /** Levels won in total, drives the bonus offer cadence. */
  wins: number;
  /** How many times each special-cat reminder tip has been shown. */
  reminders: Record<string, number>;
  /** Non-consumable products already granted (so bonus hints are given once). */
  purchased: string[];
  /** When the starter pack offer was last shown (ms). */
  starterShownAt: number;
}

const KEY = 'kedi-kacisi-save-v1';

const DEFAULTS: SaveData = {
  level: 1,
  stars: {},
  hints: 3,
  sound: true,
  vibration: true,
  music: true,
  noAds: false,
  dailyDone: null,
  streak: 0,
  levelsSinceAd: 0,
  seenKinds: [],
  giftDay: null,
  wins: 0,
  reminders: {},
  purchased: [],
  starterShownAt: 0,
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
