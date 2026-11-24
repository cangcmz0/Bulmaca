import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-ext-500.css';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-ext-600.css';
import './style.css';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { GameState } from './core/game';
import { INTRO, TOTAL_LEVELS, dailyLevel, generateLevel, kindFor } from './core/generator';
import type { Cat, CatKind } from './core/types';
import { Key, LANG, t } from './i18n';
import { ads } from './platform/ads';
import { haptics, sfx, vibrate } from './platform/audio';
import { MONET, pacing } from './platform/monetization';
import { load, save, todayKey, yesterdayKey } from './platform/storage';
import { COATS, drawCat, drawSleepy } from './render/cat';
import { HomeScene } from './render/home';
import { BoardRenderer } from './render/renderer';
import { applyTheme, themeFor } from './render/theme';
import { icons } from './ui/icons';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const data = load();
sfx.enabled = data.sound;
haptics.enabled = data.vibration;

/** Hosted privacy policy (docs/privacy-policy.html via GitHub Pages). */
const PRIVACY_URL = 'https://cangcmz0.github.io/Bulmaca/privacy-policy.html';
document.documentElement.lang = LANG;
document.title = t('title');
document.querySelectorAll<HTMLElement>('[data-t]').forEach((el) => (el.textContent = t(el.dataset.t as Key)));
$('back-btn').innerHTML = icons.back;
document.querySelector('.hint-icon')!.innerHTML = icons.bulb;

const renderer = new BoardRenderer($<HTMLCanvasElement>('board'));
const scene = new HomeScene($<HTMLCanvasElement>('home-scene'), (kind) => {
  sfx.unlock();
  if (kind === 'meow') sfx.meow();
  else sfx.hint();
  vibrate(10);
});
let state: GameState | null = null;
let isDaily = false;
let winPending = false;
/** The level clock waits for the intro banner to finish. */
let clockStartsAt = 0;
/** Failed attempts per level this session, used to offer "skip level". */
const fails = new Map<number, number>();
let combo = 0;
let lastExitAt = 0;
let levelStartedAt = 0;

// ---------------------------------------------------------------- screens

/** Levels past 8000 are "Master Mode" so the advertised count stays honest. */
function levelName(n: number): string {
  return n > TOTAL_LEVELS ? `${t('master')} ${n - TOTAL_LEVELS}` : `${t('level')} ${n}`;
}

function showScreen(id: 'home' | 'game'): void {
  $('home').classList.toggle('hidden', id !== 'home');
  $('game').classList.toggle('hidden', id !== 'game');
  if (id === 'game') requestAnimationFrame(() => renderer.resize());
  if (id === 'home') scene.start();
  else scene.stop();
}

function refreshHome(): void {
  applyTheme(themeFor(data.level));
  const n = data.level;
  const k = kindFor(n);
  const tag = k === 'hard' || k === 'boss' ? ` · ${t(k)}` : '';
  $('play-level').textContent = `${levelName(n)}${tag}`;
  const totalStars = Object.values(data.stars).reduce((a, b) => a + b, 0);
  $('stars-chip').textContent = `⭐ ${totalStars}`;
  // Progress card: the bar fills towards the next boss, a goal that is always close.
  $('pc-level').textContent = n <= TOTAL_LEVELS ? `${levelName(n)} / ${TOTAL_LEVELS}` : levelName(n);
  const toBoss = Math.ceil(n / 10) * 10 - n;
  $('pc-next').textContent = toBoss === 0 ? t('bossNext') : t('bossIn').replace('{n}', String(toBoss));
  $('pc-fill').style.width = `${(((n - 1) % 10) / 9) * 100}%`;
  const doneToday = data.dailyDone === todayKey();
  $('daily-label').textContent = doneToday ? t('dailyDone') : t('daily');
  const streakAlive = data.dailyDone === todayKey() || data.dailyDone === yesterdayKey();
  $('streak-label').textContent = streakAlive && data.streak > 0 ? `🔥 ${data.streak} ${t('streak')}` : '';
  const giftReady = data.giftDay !== todayKey();
  $('gift-label').textContent = `🎁 ${t('gift')}`;
  $('gift-sub').textContent = giftReady ? t('giftReady') : t('giftTomorrow');
  $('gift-btn').classList.toggle('ready', giftReady);
  $('settings-btn').innerHTML = icons.gear;
}

// ---------------------------------------------------------------- game flow

function startLevel(n: number): void {
  isDaily = n < 1;
  const level = isDaily ? dailyLevel(new Date()) : generateLevel(n);
  state = new GameState(level);
  winPending = false;
  const theme = themeFor(level.number);
  applyTheme(theme);
  showScreen('game');
  renderer.setState(state, theme);
  $('level-label').textContent = isDaily ? t('daily') : levelName(n);
  setTip(n === 1 ? 'tutorial1' : reminderFor(level));
  renderHearts();
  renderProgress();
  renderHints();
  renderKind();
  renderTimer();
  renderWake();
  combo = 0;
  levelStartedAt = performance.now();
  if (!isDaily) maybeIntro(n);
}

const INTRO_TEXT: Record<Exclude<CatKind, 'normal'>, [Key, Key]> = {
  sleepy: ['newSleepyTitle', 'newSleepyText'],
  scared: ['newScaredTitle', 'newScaredText'],
  spin: ['newSpinTitle', 'newSpinText'],
};

/** First time a special cat shows up, explain it on a card (the clock waits while it is open). */
function maybeIntro(n: number): void {
  const kind = (Object.keys(INTRO) as (keyof typeof INTRO)[]).find((k) => INTRO[k] === n);
  if (!kind || data.seenKinds.includes(kind)) return;
  data.seenKinds.push(kind);
  save(data);
  const [title, text] = INTRO_TEXT[kind];
  openModal('<canvas class="intro-art" id="intro-art" width="240" height="240"></canvas>', t(title), t(text), [
    { label: t('gotIt'), primary: true, run: closeModal },
  ]);
  const c = $<HTMLCanvasElement>('intro-art');
  const ctx = c.getContext('2d')!;
  const coat = COATS[kind === 'sleepy' ? 1 : kind === 'scared' ? 2 : 0];
  if (kind === 'sleepy') drawSleepy(ctx, coat, 120, 125, 200, 0.4, 1);
  else drawCat(ctx, coat, {
    x: 120, y: 128, s: 190, angle: kind === 'spin' ? Math.PI / 4 : 0, stretch: 1, scale: 1, blink: false,
    dizzy: false, hurt: 0, tail: 0.2, running: 0, sweat: kind === 'scared',
  });
}

function renderWake(): void {
  $('wake-btn').classList.toggle('hidden', !state || state.asleep.size === 0);
}

function comboText(n: number): string | null {
  if (n >= 10) return `${t('combo10')} x${n}!`;
  if (n >= 6) return `${t('combo6')} x${n}!`;
  if (n >= 3) return `${t('combo3')} x${n}!`;
  return null;
}

function renderKind(): void {
  if (!state) return;
  const { kind, timeLimit } = state.level;
  const badge = $('kind-badge');
  const shown = kind === 'easy' || kind === 'hard' || kind === 'boss';
  badge.className = `badge ${kind}${shown ? '' : ' hidden'}`;
  if (shown) badge.textContent = t(kind);
  const banner = $('banner');
  clockStartsAt = performance.now();
  if (kind === 'hard' || kind === 'boss') {
    $('banner-title').textContent = t(kind === 'boss' ? 'bossBanner' : 'hardBanner');
    $('banner-sub').textContent = kind === 'boss' ? t('bossSub') : timeLimit ? t('timedSub') : '';
    banner.className = `banner ${kind}`;
    // restart the CSS animation
    void banner.offsetWidth;
    clockStartsAt += 1600;
    window.setTimeout(() => banner.classList.add('hidden'), 1600);
  } else {
    banner.className = 'banner hidden';
  }
}

let lastTimerText = '';
function renderTimer(): void {
  const el = $('timer');
  if (!state || state.timeLeft === null) {
    el.classList.add('hidden');
    lastTimerText = '';
    return;
  }
  const s = Math.ceil(state.timeLeft);
  const text = `⏱ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  if (text === lastTimerText) return;
  if (s <= 5 && s > 0 && lastTimerText) sfx.click();
  lastTimerText = text;
  el.textContent = text;
  el.classList.remove('hidden');
  el.classList.toggle('low', s <= 10);
}

function clockRunning(now: number): boolean {
  return !!state && !winPending && now >= clockStartsAt &&
    $('modal').classList.contains('hidden') && $('ad').classList.contains('hidden') &&
    !$('game').classList.contains('hidden');
}

async function watchRewarded(): Promise<boolean> {
  // Always tell the player an ad is coming, never spring it on them.
  const notice = $('ad-notice');
  notice.textContent = t('adStarting');
  notice.classList.remove('hidden');
  await new Promise((r) => window.setTimeout(r, 1100));
  notice.classList.add('hidden');
  const ok = await ads.showRewarded();
  if (ok) pacing.rewardedWatched();
  return ok;
}

/**
 * For the first levels after a special cat is introduced, a one-line reminder of its rule. Rules
 * that look like bugs when forgotten (scared cats run backwards) come first.
 */
function reminderFor(level: { cats: Cat[] }): Key | null {
  if (isDaily) return null;
  const has = (k: CatKind) => level.cats.some((c) => c.kind === k);
  const order: [CatKind, Key][] = [['scared', 'remindScared'], ['spin', 'remindSpin'], ['sleepy', 'remindSleepy']];
  for (const [kind, key] of order) {
    if (!has(kind) || (data.reminders[kind] ?? 0) >= 10) continue;
    data.reminders[kind] = (data.reminders[kind] ?? 0) + 1;
    save(data);
    return key;
  }
  return null;
}

let tipKey: Key | null = null;
function setTip(key: Key | null): void {
  tipKey = key;
  const tip = $('tip');
  tip.classList.toggle('hidden', !key);
  if (key) tip.textContent = t(key);
}

function renderHearts(popIndex = -1): void {
  if (!state) return;
  const max = Math.max(3, state.lives);
  let html = '';
  for (let i = 0; i < max; i++) {
    const lost = i >= state.lives;
    html += `<span class="${lost ? 'lost' : ''} ${i === popIndex ? 'pop' : ''}">${icons.heart}</span>`;
  }
  $('hearts').innerHTML = html;
}

function renderProgress(): void {
  if (!state) return;
  const done = state.total - state.cats.size;
  $('progress-fill').style.width = `${(done / state.total) * 100}%`;
  $('progress-label').textContent = `${state.cats.size} ${t('catsLeft')}`;
}

function renderHints(): void {
  $('hint-count').textContent = data.hints > 0 ? String(data.hints) : '+';
}

$('board').addEventListener('pointerdown', (e) => {
  sfx.unlock();
  if (!state || winPending) return;
  const cell = renderer.cellAt(e.clientX, e.clientY);
  if (!cell) return;
  const cat = state.catAt(cell.x, cell.y);
  if (!cat || renderer.isMoving(cat.id)) return;
  const res = state.tap(cell.x, cell.y);
  if (res.kind === 'wake') {
    renderer.wake(res.cat);
    sfx.hint();
    vibrate(10);
    renderWake();
  } else if (res.kind === 'exit') {
    renderer.exit(res.cat, res.dir);
    sfx.pop();
    vibrate(8);
    renderProgress();
    const now = performance.now();
    combo = now - lastExitAt < 1600 ? combo + 1 : 1;
    lastExitAt = now;
    const label = comboText(combo);
    if (label) {
      const { px, py } = renderer.cellCenter(res.cat.x, res.cat.y);
      renderer.floatText(px, py - 20, label, combo >= 10 ? '#ff6fa8' : combo >= 6 ? '#ffcf4a' : '#ffffff');
    }
    if (tipKey === 'wrongMove') setTip(null);
    if (state.won) winPending = true;
    else scheduleTrapCheck();
  } else if (res.kind === 'bump') {
    combo = 0;
    renderer.bump(res.cat, res.dir, res.steps);
    const delay = Math.max(60, (res.steps / 16) * 1000);
    window.setTimeout(() => { sfx.meow(); vibrate(60); renderHearts(state!.lives); }, delay);
    if (state.level.number === 1) setTip('tutorial2');
    if (state.lost) window.setTimeout(() => showLose(), 900);
  }
});

function finishWin(): void {
  if (!state) return;
  winPending = false;
  const stars = state.stars();
  const n = state.level.number;
  const boss = state.level.kind === 'boss';
  const perfect = state.mistakes === 0;
  const secs = Math.round((performance.now() - levelStartedAt) / 1000);
  const statsLine = `⏱ ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} · ${state.mistakes} ${t('mistakesWord')}`;
  renderer.celebrate(boss || perfect);
  sfx.win();
  if (perfect) window.setTimeout(() => sfx.win(), 380);
  if (isDaily) {
    const today = todayKey();
    if (data.dailyDone !== today) {
      data.streak = data.dailyDone === yesterdayKey() ? data.streak + 1 : 1;
      data.dailyDone = today;
    }
  } else {
    data.stars[n] = Math.max(data.stars[n] ?? 0, stars);
    data.level = Math.max(data.level, n + 1);
    data.levelsSinceAd++;
    data.wins++;
    if (boss) data.hints += MONET.bossHintReward;
  }
  fails.delete(n);
  save(data);
  renderHints();
  window.setTimeout(() => {
    const art = [1, 2, 3].map((i) => `<span class="star ${i > stars ? 'off' : ''}">${icons.star}</span>`).join('') +
      `<div class="stats">${statsLine}</div>`;
    if (n === TOTAL_LEVELS) {
      openModal(art, t('finalTitle'), t('finalText'), [
        { label: t('toMaster'), primary: true, run: () => void nextLevel(n + 1) },
        { label: t('home'), run: goHome },
      ]);
    } else if (isDaily) {
      openModal(art, t('winDaily'), data.streak > 0 ? `🔥 ${data.streak} ${t('streak')}` : '', [
        { label: t('home'), primary: true, run: goHome },
      ]);
    } else if (boss) {
      // Rewarded "multiply your prize" right after a win is the best-performing ad slot in puzzles.
      openModal(art, t('bossWin'), t('bossReward'), [
        {
          label: t('tripleReward'), primary: true,
          run: async () => {
            closeModal();
            if (await watchRewarded()) {
              data.hints += MONET.bossHintReward * (MONET.bossRewardMultiplier - 1);
              save(data);
              renderHints();
              sfx.hint();
            }
            startLevel(n + 1);
          },
        },
        { label: t('next'), run: () => void nextLevel(n + 1) },
      ]);
    } else {
      const actions: Action[] = [{ label: t('next'), primary: true, run: () => void nextLevel(n + 1) }];
      // An optional bonus every few wins: revenue the player chooses, never forced.
      if (data.wins % MONET.bonusOfferEvery === 0) {
        actions.push({
          label: t('bonusHint'),
          run: async () => {
            closeModal();
            if (await watchRewarded()) {
              data.hints += 1;
              save(data);
              renderHints();
              sfx.hint();
            }
            startLevel(n + 1);
          },
        });
      }
      actions.push({ label: t('home'), run: goHome });
      openModal(art, perfect ? t('perfect') : t('winTitle'), '', actions);
    }
  }, 650);
}

async function nextLevel(n: number): Promise<void> {
  closeModal();
  if (pacing.shouldShowInterstitial(n, data.levelsSinceAd, data.noAds)) {
    data.levelsSinceAd = 0;
    save(data);
    pacing.interstitialShown();
    await ads.showInterstitial();
  }
  startLevel(n);
}

function showLose(firstTime = true): void {
  if (!state || !state.lost) return;
  const n = state.level.number;
  const reason = state.loseReason;
  if (reason === 'stuck') { showTrapped(firstTime); return; }
  if (firstTime) {
    sfx.lose();
    fails.set(n, (fails.get(n) ?? 0) + 1);
  }
  const actions: Action[] = [];
  if (reason === 'time') {
    actions.push({
      label: t('watchTime'), primary: true,
      run: async () => {
        closeModal();
        if (await watchRewarded()) state!.addTime(MONET.rewardedSeconds);
        else showLose(false);
      },
    });
  } else {
    actions.push({
      label: t('watchLife'), primary: true,
      run: async () => {
        closeModal();
        if (await watchRewarded()) {
          state!.addLife(MONET.rewardedLives);
          renderHearts(0);
        } else showLose(false);
      },
    });
  }
  const tough = state.level.kind === 'hard' || state.level.kind === 'boss';
  if (!isDaily && tough && (fails.get(n) ?? 0) >= MONET.skipAfterFails) {
    actions.push({
      label: t('skip'),
      run: async () => {
        closeModal();
        if (await watchRewarded()) {
          data.stars[n] = Math.max(data.stars[n] ?? 0, 1);
          data.level = Math.max(data.level, n + 1);
          fails.delete(n);
          save(data);
          startLevel(n + 1);
        } else showLose(false);
      },
    });
  }
  actions.push({
    label: t('retry'),
    run: () => {
      // Never show a forced ad right after a loss: that is when players quit.
      closeModal();
      startLevel(n);
    },
  });
  const copy: Record<string, [string, Key, Key]> = {
    time: ['<span class="big-emoji">⏰</span>', 'timeUpTitle', 'timeUpText'],
    lives: [icons.brokenHeart, 'loseTitle', 'loseText'],
  };
  const [art, title, text] = copy[reason ?? 'lives'];
  openModal(art, t(title), t(text), actions);
}

/**
 * Takes moves back until the position can be won again (usually one or two). One rewarded ad
 * buys the whole rewind, so getting stuck stays a lesson rather than a wall.
 */
function undoToWinnable(): void {
  if (!state) return;
  let guard = state.history.length;
  let culprit: Cat | undefined;
  do {
    const c = state.undo();
    if (!c) break;
    renderer.restore(c);
    culprit = c;
  } while (guard-- > 0 && state.hint().kind === 'doomed');
  // The last cat put back is the move that sealed the trap: mark it so the player tries elsewhere.
  if (culprit) {
    renderer.markWrong(culprit);
    setTip('wrongMove');
  }
  renderProgress();
  sfx.hint();
}

let trapCheck = 0;
/**
 * Right after a move, check whether it left the level unwinnable (spin cats locked so no order
 * can finish). If so, say it straight away instead of letting the player play on for nothing.
 */
function scheduleTrapCheck(): void {
  if (!state) return;
  const token = ++trapCheck;
  const exits = state.exits;
  const spinsLeft = [...state.cats.values()].some((c) => c.kind === 'spin');
  if (!spinsLeft && !state.stuck) return; // without spin cats the order can't trap you
  window.setTimeout(() => {
    if (!state || token !== trapCheck || state.exits !== exits || state.won || winPending) return;
    if (!$('modal').classList.contains('hidden') || !$('ad').classList.contains('hidden')) return;
    if (state.stuck || state.hint().kind === 'doomed') showTrapped(true);
  }, 650);
}

function showTrapped(firstTime: boolean): void {
  if (!state) return;
  const n = state.level.number;
  if (firstTime) {
    sfx.lose();
    vibrate(80);
    fails.set(n, (fails.get(n) ?? 0) + 1);
  }
  const actions: Action[] = [{
    label: t('watchUndo'), primary: true,
    run: async () => {
      closeModal();
      if (await watchRewarded()) undoToWinnable();
      else showTrapped(false);
    },
  }];
  const tough = state.level.kind === 'hard' || state.level.kind === 'boss';
  if (!isDaily && tough && (fails.get(n) ?? 0) >= MONET.skipAfterFails) {
    actions.push({
      label: t('skip'),
      run: async () => {
        closeModal();
        if (await watchRewarded()) {
          data.stars[n] = Math.max(data.stars[n] ?? 0, 1);
          data.level = Math.max(data.level, n + 1);
          fails.delete(n);
          save(data);
          startLevel(n + 1);
        } else showTrapped(false);
      },
    });
  }
  actions.push({ label: t('retry'), run: () => { closeModal(); startLevel(n); } });
  openModal('<span class="big-emoji">🪤</span>', t('trappedTitle'), t('trappedText'), actions, t('trappedAdNote'));
}

$('hint-btn').addEventListener('click', () => {
  sfx.unlock();
  if (!state || state.won) return;
  const h = state.hint();
  if (h.kind === 'doomed') {
    // Spin cats are turned so that no order can win from here: say so instead of burning a hint.
    showTrapped(false);
    return;
  }
  if (data.hints > 0) {
    data.hints--;
    save(data);
    renderHints();
    renderer.hint(h.cat);
    sfx.hint();
    return;
  }
  openModal(icons.bulb, t('hintTitle'), t('hintText'), [
    {
      label: t('watchHint'), primary: true,
      run: async () => {
        closeModal();
        if (await watchRewarded()) {
          data.hints += MONET.rewardedHints;
          save(data);
          renderHints();
        }
      },
    },
    { label: t('cancel'), run: closeModal },
  ]);
});

$('wake-btn').addEventListener('click', () => {
  sfx.unlock();
  if (!state || state.asleep.size === 0) return;
  openModal('<span class="big-emoji">😴</span>', t('wakeAllTitle'), t('wakeAllText'), [
    {
      label: t('watchWake'), primary: true,
      run: async () => {
        closeModal();
        if (state && (await watchRewarded())) {
          state.wakeAll().forEach((c: Cat) => renderer.wake(c));
          renderWake();
          sfx.hint();
        }
      },
    },
    { label: t('cancel'), run: closeModal },
  ]);
});

$('gift-btn').addEventListener('click', () => {
  sfx.unlock();
  sfx.click();
  if (data.giftDay === todayKey()) return;
  const claim = (hints: number) => {
    data.giftDay = todayKey();
    data.hints += hints;
    save(data);
    renderHints();
    sfx.win();
    refreshHome();
  };
  openModal('<span class="big-emoji">🎁</span>', t('giftTitle'), t('giftText'), [
    {
      label: t('giftTriple'), primary: true,
      run: async () => {
        closeModal();
        claim(MONET.dailyGiftHints * ((await watchRewarded()) ? MONET.dailyGiftMultiplier : 1));
      },
    },
    { label: t('giftTake'), run: () => { closeModal(); claim(MONET.dailyGiftHints); } },
  ]);
});

function goHome(): void {
  closeModal();
  state = null;
  refreshHome();
  showScreen('home');
}

$('back-btn').addEventListener('click', () => { sfx.click(); goHome(); });
$('play-btn').addEventListener('click', () => { sfx.unlock(); sfx.click(); startLevel(data.level); });
$('daily-btn').addEventListener('click', () => { sfx.unlock(); sfx.click(); startLevel(-1); });
function openSettings(): void {
  const onOff = (v: boolean) => (v ? t('on') : t('off'));
  const actions: Action[] = [
    {
      label: `${data.sound ? '🔊' : '🔈'} ${t('sound')}: ${onOff(data.sound)}`,
      run: () => { data.sound = !data.sound; sfx.enabled = data.sound; save(data); sfx.unlock(); sfx.click(); openSettings(); },
    },
    {
      label: `📳 ${t('vibration')}: ${onOff(data.vibration)}`,
      run: () => { data.vibration = !data.vibration; haptics.enabled = data.vibration; save(data); vibrate(30); openSettings(); },
    },
  ];
  // Required by Google's consent rules for players in the EU/UK.
  if (ads.privacyOptionsRequired()) {
    actions.push({ label: t('privacyOptions'), run: async () => { closeModal(); await ads.showPrivacyOptions(); } });
  }
  actions.push({ label: t('privacyPolicy'), run: () => { window.open(PRIVACY_URL, '_blank'); } });
  actions.push({ label: t('close'), primary: true, run: closeModal });
  openModal(icons.gear.replace('<svg', '<svg class="settings-art"'), t('settings'), '', actions, `${t('title')} · ${t('version')} ${__APP_VERSION__}`);
}

$('settings-btn').addEventListener('click', () => { sfx.unlock(); sfx.click(); openSettings(); });

// ---------------------------------------------------------------- Android integration

if (Capacitor.isNativePlatform()) {
  let lastBack = 0;
  void App.addListener('backButton', () => {
    if (!$('ad').classList.contains('hidden')) return; // never skip an ad with back
    if (!$('modal').classList.contains('hidden')) {
      // Back closes a card only when it has a harmless way out (settings, offers, intros).
      const title = $('modal-title').textContent ?? '';
      const blocking = [t('trappedTitle'), t('loseTitle'), t('timeUpTitle')].includes(title);
      if (!blocking) { closeModal(); return; }
      if (state) { closeModal(); startLevel(state.level.number); }
      return;
    }
    if (!$('game').classList.contains('hidden')) { goHome(); return; }
    const now = Date.now();
    if (now - lastBack < 2000) { void App.exitApp(); return; }
    lastBack = now;
    const notice = $('ad-notice');
    notice.textContent = t('exitHint');
    notice.classList.remove('hidden');
    window.setTimeout(() => notice.classList.add('hidden'), 1800);
  });
  void App.addListener('pause', () => sfx.suspend());
}

// ---------------------------------------------------------------- modal

interface Action { label: string; primary?: boolean; run: () => void | Promise<void> }

function openModal(artHtml: string, title: string, text: string, actions: Action[], note = ''): void {
  $('modal-art').innerHTML = artHtml;
  $('modal-title').textContent = title;
  const p = $('modal-text');
  p.textContent = text;
  p.hidden = !text;
  const nt = $('modal-note');
  nt.textContent = note;
  nt.hidden = !note;
  const box = $('modal-actions');
  box.innerHTML = '';
  for (const a of actions) {
    const b = document.createElement('button');
    b.className = `btn ${a.primary ? 'btn-primary' : 'btn-ghost'}`;
    b.textContent = a.label;
    b.onclick = () => { sfx.click(); void a.run(); };
    box.appendChild(b);
  }
  $('modal').classList.remove('hidden');
}

function closeModal(): void {
  $('modal').classList.add('hidden');
}

// ---------------------------------------------------------------- loop

let lastFrame = performance.now();
function loop(now: number): void {
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  renderer.frame(now);
  if (winPending && renderer.catsVisible === 0) finishWin();
  if (state && clockRunning(now)) {
    if (state.tick(dt)) showLose();
    renderTimer();
  }
  requestAnimationFrame(loop);
}

refreshHome();
showScreen('home');
// Consent form (where required) and ad SDK start, after the first frame so launch stays quick.
requestAnimationFrame(() => void ads.init());
requestAnimationFrame(loop);

// Dev helpers: ?level=N jumps straight into a level, &time=S shortens its clock for testing.
const params = new URLSearchParams(location.search);
const jump = Number(params.get('level'));
if (jump > 0) {
  startLevel(jump);
  const s = Number(params.get('time'));
  const st = state as GameState | null; // assigned inside startLevel, TS can't see it
  if (s > 0 && st && st.timeLeft !== null) st.timeLeft = s;
}
// Test hook for automated QA (?debug=1): exposes the live game to the test runner.
if (params.get('debug') === '1') {
  (window as unknown as Record<string, unknown>).__kk = {
    get state() { return state; },
    renderer,
    start: (n: number) => startLevel(n),
  };
}
