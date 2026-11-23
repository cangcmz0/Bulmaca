const STRINGS = {
  tr: {
    title: 'Kedi Kaçışı',
    subtitle: 'Kedileri doğru sırayla kaçır!',
    play: 'Oyna',
    level: 'Seviye',
    daily: 'Günün Bulmacası',
    dailyDone: 'Bugünkü tamam ✓',
    streak: 'gün seri',
    catsLeft: 'kedi kaldı',
    hint: 'İpucu',
    winTitle: 'Harika!',
    winDaily: 'Günün bulmacası çözüldü!',
    next: 'Sonraki',
    home: 'Ana sayfa',
    loseTitle: 'Canın bitti',
    loseText: 'Kediler birbirine çarptı. Bir can daha ister misin?',
    watchLife: 'Reklam izle, +1 can',
    retry: 'Baştan başla',
    hintTitle: 'İpucu bitti',
    hintText: 'Kısa bir reklam izle, 2 ipucu kazan.',
    watchHint: 'Reklam izle, +2 ipucu',
    cancel: 'Vazgeç',
    adTest: 'Test reklamı',
    tutorial1: 'Bir kediye dokun: baktığı yöne kaçar.',
    tutorial2: 'Önü kapalıysa çarpar ve can gider. Önce öndekini kaçır!',
    sound: 'Ses',
  },
  en: {
    title: 'Cat Escape',
    subtitle: 'Let the cats out in the right order!',
    play: 'Play',
    level: 'Level',
    daily: 'Daily Puzzle',
    dailyDone: 'Done for today ✓',
    streak: 'day streak',
    catsLeft: 'cats left',
    hint: 'Hint',
    winTitle: 'Purrfect!',
    winDaily: 'Daily puzzle solved!',
    next: 'Next',
    home: 'Home',
    loseTitle: 'Out of lives',
    loseText: 'The cats bumped into each other. Want one more life?',
    watchLife: 'Watch ad, +1 life',
    retry: 'Restart',
    hintTitle: 'No hints left',
    hintText: 'Watch a short ad to get 2 hints.',
    watchHint: 'Watch ad, +2 hints',
    cancel: 'Cancel',
    adTest: 'Test ad',
    tutorial1: 'Tap a cat: it runs the way it faces.',
    tutorial2: 'If the way is blocked it bumps and you lose a life. Free the front cat first!',
    sound: 'Sound',
  },
} as const;

export type Key = keyof (typeof STRINGS)['tr'];

const lang: keyof typeof STRINGS = (() => {
  try {
    const forced = new URLSearchParams(location.search).get('lang');
    if (forced === 'tr' || forced === 'en') return forced;
    return navigator.language.toLowerCase().startsWith('tr') ? 'tr' : 'en';
  } catch {
    return 'en';
  }
})();

export function t(key: Key): string {
  return STRINGS[lang][key];
}

export const LANG = lang;
