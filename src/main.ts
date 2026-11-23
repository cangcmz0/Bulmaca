import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-ext-500.css';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-ext-600.css';
import './style.css';
import { GameState } from './core/game';
import { TOTAL_LEVELS, dailyLevel, generateLevel, kindFor } from './core/generator';
import { Key, LANG, t } from './i18n';
import { ads } from './platform/ads';
import { sfx, vibrate } from './platform/audio';
import { MONET, pacing } from './platform/monetization';
import { load, save, todayKey, yesterdayKey } from './platform/storage';
import { COATS, drawCat } from './render/cat';
import { BoardRenderer } from './render/renderer';
import { applyTheme, themeFor } from './render/theme';
import { icons } from './ui/icons';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const data = load();
sfx.enabled = data.sound;
document.documentElement.lang = LANG;
document.title = t('title');
document.querySelectorAll<HTMLElement>('[data-t]').forEach((el) => (el.textContent = t(el.dataset.t as Key)));
$('back-btn').innerHTML = icons.back;
document.querySelector('.hint-icon')!.innerHTML = icons.bulb;

const renderer = new BoardRenderer($<HTMLCanvasElement>('board'));
let state: GameState | null = null;
let isDaily = false;
let winPending = false;
/** The level clock waits for the intro banner to finish. */
let clockStartsAt = 0;
/** Failed attempts per level this session, used to offer "skip level". */
const fails = new Map<number, number>();

// ---------------------------------------------------------------- screens

/** Levels past 8000 are "Master Mode" so the advertised count stays honest. */
function levelName(n: number): string {
  return n > TOTAL_LEVELS ? `${t('master')} ${n - TOTAL_LEVELS}` : `${t('level')} ${n}`;
}

function showScreen(id: 'home' | 'game'): void {
  $('home').classList.toggle('hidden', id !== 'home');
  $('game').classList.toggle('hidden', id !== 'game');
  if (id === 'game') requestAnimationFrame(() => renderer.resize());
}

function refreshHome(): void {
  applyTheme(themeFor(data.level));
  const k = kindFor(data.level);
  const tag = k === 'hard' || k === 'boss' ? ` · ${t(k)}` : '';
  const of = data.level <= TOTAL_LEVELS ? ` / ${TOTAL_LEVELS}` : '';
  $('play-level').textContent = `${levelName(data.level)}${of}${tag}`;
  const doneToday = data.dailyDone === todayKey();
  $('daily-label').textContent = doneToday ? t('dailyDone') : t('daily');
  const streakAlive = data.dailyDone === todayKey() || data.dailyDone === yesterdayKey();
  $('streak-label').textContent = streakAlive && data.streak > 0 ? `🔥 ${data.streak} ${t('streak')}` : '';
  $('sound-btn').innerHTML = data.sound ? icons.soundOn : icons.soundOff;
  drawLogo();
}

function drawLogo(): void {
  const c = $<HTMLCanvasElement>('logo-cat');
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, c.width, c.height);
  drawCat(ctx, COATS[0], {
    x: 240, y: 264, s: 420, angle: 0, stretch: 1, scale: 1, blink: false,
    dizzy: false, hurt: 0, tail: 0.25, running: 0,
  });
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
  setTip(n === 1 ? 'tutorial1' : null);
  renderHearts();
  renderProgress();
  renderHints();
  renderKind();
  renderTimer();
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
  const ok = await ads.showRewarded();
  if (ok) pacing.rewardedWatched();
  return ok;
}

function setTip(key: Key | null): void {
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
  if (res.kind === 'exit') {
    renderer.exit(res.cat);
    sfx.pop();
    vibrate(8);
    renderProgress();
    if (state.won) winPending = true;
  } else if (res.kind === 'bump') {
    renderer.bump(res.cat, res.steps);
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
  renderer.celebrate();
  sfx.win();
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
    if (boss) data.hints += MONET.bossHintReward;
  }
  fails.delete(n);
  save(data);
  renderHints();
  window.setTimeout(() => {
    const art = [1, 2, 3].map((i) => `<span class="star ${i > stars ? 'off' : ''}">${icons.star}</span>`).join('');
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
      openModal(art, t('winTitle'), '', [
        { label: t('next'), primary: true, run: () => void nextLevel(n + 1) },
        { label: t('home'), run: goHome },
      ]);
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
      // Retries count towards interstitial pacing like a finished level.
      if (!isDaily) data.levelsSinceAd++;
      void nextLevel(n);
    },
  });
  const art = reason === 'time' ? `<span class="big-emoji">⏰</span>` : icons.brokenHeart;
  openModal(art, t(reason === 'time' ? 'timeUpTitle' : 'loseTitle'), t(reason === 'time' ? 'timeUpText' : 'loseText'), actions);
}

$('hint-btn').addEventListener('click', () => {
  sfx.unlock();
  if (!state || state.won) return;
  if (data.hints > 0) {
    const cat = state.hint();
    if (!cat) return;
    data.hints--;
    save(data);
    renderHints();
    renderer.hint(cat);
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

function goHome(): void {
  closeModal();
  state = null;
  refreshHome();
  showScreen('home');
}

$('back-btn').addEventListener('click', () => { sfx.click(); goHome(); });
$('play-btn').addEventListener('click', () => { sfx.unlock(); sfx.click(); startLevel(data.level); });
$('daily-btn').addEventListener('click', () => { sfx.unlock(); sfx.click(); startLevel(-1); });
$('sound-btn').addEventListener('click', () => {
  data.sound = !data.sound;
  sfx.enabled = data.sound;
  save(data);
  sfx.unlock();
  sfx.click();
  refreshHome();
});

// ---------------------------------------------------------------- modal

interface Action { label: string; primary?: boolean; run: () => void | Promise<void> }

function openModal(artHtml: string, title: string, text: string, actions: Action[]): void {
  $('modal-art').innerHTML = artHtml;
  $('modal-title').textContent = title;
  const p = $('modal-text');
  p.textContent = text;
  p.hidden = !text;
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
