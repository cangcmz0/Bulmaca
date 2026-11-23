import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-ext-500.css';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-ext-600.css';
import './style.css';
import { GameState } from './core/game';
import { dailyLevel, generateLevel } from './core/generator';
import { Key, LANG, t } from './i18n';
import { ads } from './platform/ads';
import { sfx, vibrate } from './platform/audio';
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

// ---------------------------------------------------------------- screens

function showScreen(id: 'home' | 'game'): void {
  $('home').classList.toggle('hidden', id !== 'home');
  $('game').classList.toggle('hidden', id !== 'game');
  if (id === 'game') requestAnimationFrame(() => renderer.resize());
}

function refreshHome(): void {
  applyTheme(themeFor(data.level));
  $('play-level').textContent = `${t('level')} ${data.level}`;
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
  $('level-label').textContent = isDaily ? t('daily') : `${t('level')} ${n}`;
  setTip(n === 1 ? 'tutorial1' : null);
  renderHearts();
  renderProgress();
  renderHints();
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
    if (state.lost) window.setTimeout(showLose, 900);
  }
});

function finishWin(): void {
  if (!state) return;
  winPending = false;
  const stars = state.stars();
  renderer.celebrate();
  sfx.win();
  if (isDaily) {
    const today = todayKey();
    if (data.dailyDone !== today) {
      data.streak = data.dailyDone === yesterdayKey() ? data.streak + 1 : 1;
      data.dailyDone = today;
    }
  } else {
    const n = state.level.number;
    data.stars[n] = Math.max(data.stars[n] ?? 0, stars);
    data.level = Math.max(data.level, n + 1);
    data.levelsSinceAd++;
  }
  save(data);
  const n = state.level.number;
  window.setTimeout(() => {
    const art = [1, 2, 3].map((i) => `<span class="star ${i > stars ? 'off' : ''}">${icons.star}</span>`).join('');
    openModal(art, isDaily ? t('winDaily') : t('winTitle'), isDaily && data.streak > 0 ? `🔥 ${data.streak} ${t('streak')}` : '', [
      isDaily
        ? { label: t('home'), primary: true, run: goHome }
        : { label: t('next'), primary: true, run: () => void nextLevel(n + 1) },
      ...(isDaily ? [] : [{ label: t('home'), run: goHome }]),
    ]);
  }, 650);
}

async function nextLevel(n: number): Promise<void> {
  closeModal();
  // Interstitials stay out of the first 10 levels and show at most every 3 levels.
  if (!data.noAds && n > 10 && data.levelsSinceAd >= 3) {
    data.levelsSinceAd = 0;
    save(data);
    await ads.showInterstitial();
  }
  startLevel(n);
}

function showLose(): void {
  if (!state) return;
  sfx.lose();
  const n = state.level.number;
  openModal(icons.brokenHeart, t('loseTitle'), t('loseText'), [
    {
      label: t('watchLife'), primary: true,
      run: async () => {
        closeModal();
        if (await ads.showRewarded()) {
          state!.addLife(1);
          renderHearts(0);
        } else showLose();
      },
    },
    { label: t('retry'), run: () => { closeModal(); startLevel(n); } },
  ]);
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
        if (await ads.showRewarded()) {
          data.hints += 2;
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

function loop(now: number): void {
  renderer.frame(now);
  if (winPending && renderer.catsVisible === 0) finishWin();
  requestAnimationFrame(loop);
}

refreshHome();
requestAnimationFrame(loop);

// Dev helper: ?level=N jumps straight into a level.
const jump = Number(new URLSearchParams(location.search).get('level'));
if (jump > 0) startLevel(jump);
