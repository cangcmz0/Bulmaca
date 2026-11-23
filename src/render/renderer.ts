import { GameState } from '../core/game';
import { Cat, DX, DY, idx } from '../core/types';
import { COATS, CatPose, drawCat } from './cat';
import { Theme } from './theme';

type Mode = 'idle' | 'exit' | 'bump';

interface VCat {
  id: number;
  cell: { x: number; y: number };
  dir: number;
  coat: number;
  phase: number;
  blinkAt: number;
  mode: Mode;
  t0: number;
  /** bump: how far forward (cells) before bouncing back */
  reach: number;
  shakeUntil: number;
  hurtUntil: number;
  dizzyUntil: number;
  lastDust: number;
  /** current offset along facing direction, in cells */
  offset: number;
}

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; max: number;
  color: string; size: number;
  kind: 'dust' | 'confetti' | 'star';
  rot: number; vr: number;
}

const EXIT_V0 = 7; // cells/s
const EXIT_ACC = 70; // cells/s^2
const BUMP_SPEED = 16;
const BUMP_BACK = 0.3; // s

const CONFETTI = ['#ff7b54', '#ffcf4a', '#5ec27a', '#4aa8ff', '#c46bff', '#ff6fa8'];

export class BoardRenderer {
  private ctx: CanvasRenderingContext2D;
  private board: HTMLCanvasElement = document.createElement('canvas');
  private state: GameState | null = null;
  private theme!: Theme;
  private vcats = new Map<number, VCat>();
  private particles: Particle[] = [];
  private W = 0;
  private H = 0;
  private dpr = 1;
  private cs = 40;
  private ox = 0;
  private oy = 0;
  private shakeUntil = 0;
  private hintId = -1;
  private hintUntil = 0;
  private last = performance.now();

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    new ResizeObserver(() => this.resize()).observe(canvas);
  }

  setState(state: GameState, theme: Theme): void {
    this.state = state;
    this.theme = theme;
    this.particles = [];
    this.hintId = -1;
    this.vcats.clear();
    const now = performance.now();
    for (const c of state.cats.values()) {
      this.vcats.set(c.id, {
        id: c.id, cell: { x: c.x, y: c.y }, dir: c.dir, coat: c.coat,
        phase: Math.random() * Math.PI * 2, blinkAt: now + 1000 + Math.random() * 4000,
        mode: 'idle', t0: 0, reach: 0, shakeUntil: 0, hurtUntil: 0, dizzyUntil: 0, lastDust: 0, offset: 0,
      });
    }
    this.resize();
  }

  /** True while any cat is still on screen (exiting cats count). */
  get catsVisible(): number {
    return this.vcats.size;
  }

  resize(): void {
    const r = this.canvas.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.W = r.width;
    this.H = r.height;
    this.canvas.width = Math.round(r.width * this.dpr);
    this.canvas.height = Math.round(r.height * this.dpr);
    if (!this.state) return;
    const { w, h } = this.state.level;
    this.cs = Math.floor(Math.min(this.W / (w + 0.8), this.H / (h + 0.8), 92));
    this.ox = Math.round((this.W - this.cs * w) / 2);
    this.oy = Math.round((this.H - this.cs * h) / 2);
    this.drawBoardCache();
  }

  cellAt(clientX: number, clientY: number): { x: number; y: number } | null {
    if (!this.state) return null;
    const r = this.canvas.getBoundingClientRect();
    const x = Math.floor((clientX - r.left - this.ox) / this.cs);
    const y = Math.floor((clientY - r.top - this.oy) / this.cs);
    return this.state.isActive(x, y) ? { x, y } : null;
  }

  exit(cat: Cat): void {
    const v = this.vcats.get(cat.id);
    if (!v) return;
    v.mode = 'exit';
    v.t0 = performance.now();
    if (this.hintId === cat.id) this.hintId = -1;
    const { px, py } = this.center(v.cell.x, v.cell.y);
    this.puff(px, py, 6);
  }

  bump(cat: Cat, steps: number): void {
    const v = this.vcats.get(cat.id);
    if (!v || v.mode !== 'idle') return;
    v.mode = 'bump';
    v.t0 = performance.now();
    v.reach = steps + 0.32;
  }

  hint(cat: Cat): void {
    this.hintId = cat.id;
    this.hintUntil = performance.now() + 4000;
  }

  celebrate(): void {
    for (let i = 0; i < 120; i++) {
      this.particles.push({
        x: this.W * Math.random(), y: -20 - Math.random() * this.H * 0.4,
        vx: (Math.random() - 0.5) * 120, vy: 80 + Math.random() * 160,
        life: 0, max: 2.2 + Math.random(), color: CONFETTI[i % CONFETTI.length],
        size: 5 + Math.random() * 6, kind: 'confetti', rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12,
      });
    }
  }

  isMoving(id: number): boolean {
    const v = this.vcats.get(id);
    return !!v && v.mode !== 'idle';
  }

  frame(now: number): void {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.W, this.H);
    if (!this.state) return;

    ctx.save();
    if (now < this.shakeUntil) {
      const k = (this.shakeUntil - now) / 250;
      ctx.translate(Math.sin(now / 18) * 5 * k, Math.cos(now / 23) * 3 * k);
    }
    ctx.drawImage(this.board, 0, 0, this.W, this.H);
    this.drawHint(now);

    const list = [...this.vcats.values()];
    for (const v of list) this.update(v, now);
    list.sort((a, b) => (a.mode === 'idle' ? 0 : 1) - (b.mode === 'idle' ? 0 : 1) || a.cell.y - b.cell.y);
    for (const v of list) this.drawVCat(v, now);
    ctx.restore();

    this.drawParticles(dt);
  }

  // ---------------------------------------------------------------------------

  private center(x: number, y: number): { px: number; py: number } {
    return { px: this.ox + (x + 0.5) * this.cs, py: this.oy + (y + 0.5) * this.cs };
  }

  private update(v: VCat, now: number): void {
    const t = (now - v.t0) / 1000;
    if (v.mode === 'exit') {
      v.offset = EXIT_V0 * t + 0.5 * EXIT_ACC * t * t;
      const { px, py } = this.center(v.cell.x + DX[v.dir] * v.offset, v.cell.y + DY[v.dir] * v.offset);
      if (now - v.lastDust > 45) {
        v.lastDust = now;
        this.puff(px - DX[v.dir] * this.cs * 0.4, py - DY[v.dir] * this.cs * 0.4, 1);
      }
      const m = this.cs;
      if (px < -m || py < -m || px > this.W + m || py > this.H + m) this.vcats.delete(v.id);
    } else if (v.mode === 'bump') {
      const forward = Math.max(0.06, v.reach / BUMP_SPEED);
      if (t < forward) {
        v.offset = v.reach * (t / forward) ** 1.4;
      } else {
        if (v.hurtUntil < v.t0) this.impact(v, now);
        const b = Math.min(1, (t - forward) / BUMP_BACK);
        v.offset = v.reach * (1 - easeOutBack(b));
        if (b >= 1) { v.mode = 'idle'; v.offset = 0; }
      }
    }
    if (v.mode === 'idle' && now > v.blinkAt + 140) v.blinkAt = now + 2000 + Math.random() * 5000;
  }

  private impact(v: VCat, now: number): void {
    v.hurtUntil = now + 600;
    v.dizzyUntil = now + 900;
    this.shakeUntil = now + 250;
    const { px, py } = this.center(
      v.cell.x + DX[v.dir] * (v.reach + 0.3),
      v.cell.y + DY[v.dir] * (v.reach + 0.3),
    );
    // shake the cat that was hit
    for (const o of this.vcats.values()) {
      const c = this.center(o.cell.x, o.cell.y);
      if (Math.hypot(c.px - px, c.py - py) < this.cs * 0.7) o.shakeUntil = now + 350;
    }
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      this.particles.push({
        x: px, y: py, vx: Math.cos(a) * 140, vy: Math.sin(a) * 140 - 40, life: 0, max: 0.55,
        color: i % 2 ? '#ffcf4a' : '#ffffff', size: this.cs * 0.12, kind: 'star', rot: a, vr: 6,
      });
    }
  }

  private drawVCat(v: VCat, now: number): void {
    const cs = this.cs;
    const { px, py } = this.center(v.cell.x + DX[v.dir] * v.offset, v.cell.y + DY[v.dir] * v.offset);
    let sx = 0;
    if (now < v.shakeUntil) sx = Math.sin(now / 20) * cs * 0.06 * ((v.shakeUntil - now) / 350);
    const idle = v.mode === 'idle';
    const breathe = idle ? 1 + Math.sin(now / 650 + v.phase) * 0.025 : 1;
    let stretch = 1;
    if (v.mode === 'exit') stretch = (now - v.t0) < 60 ? 0.86 : 1.14;
    if (v.mode === 'bump') stretch = 1.08;
    const hinted = this.hintId === v.id && now < this.hintUntil;
    const pose: CatPose = {
      x: px + sx, y: py, s: cs * 0.9, angle: (v.dir * Math.PI) / 2,
      stretch, scale: breathe * (hinted ? 1 + Math.sin(now / 120) * 0.05 : 1),
      blink: idle && now > v.blinkAt && now < v.blinkAt + 140,
      dizzy: now < v.dizzyUntil,
      hurt: now < v.hurtUntil ? (v.hurtUntil - now) / 600 : 0,
      tail: Math.sin(now / (v.mode === 'idle' ? 520 : 90) + v.phase) * 0.35,
      running: v.mode === 'idle' ? 0 : 1,
    };
    drawCat(this.ctx, COATS[v.coat % COATS.length], pose);
  }

  private drawHint(now: number): void {
    if (this.hintId < 0 || now > this.hintUntil) return;
    const v = this.vcats.get(this.hintId);
    if (!v || v.mode !== 'idle') return;
    const ctx = this.ctx;
    const { px, py } = this.center(v.cell.x, v.cell.y);
    const pulse = (now % 900) / 900;
    ctx.strokeStyle = this.theme.accent;
    ctx.globalAlpha = 1 - pulse;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(px, py, this.cs * (0.42 + pulse * 0.25), 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.55;
    ctx.setLineDash([this.cs * 0.12, this.cs * 0.14]);
    ctx.lineDashOffset = -now / 25;
    ctx.lineWidth = Math.max(3, this.cs * 0.07);
    const { w, h } = this.state!.level;
    const ex = DX[v.dir] > 0 ? w : DX[v.dir] < 0 ? -1 : v.cell.x;
    const ey = DY[v.dir] > 0 ? h : DY[v.dir] < 0 ? -1 : v.cell.y;
    const end = this.center(ex, ey);
    ctx.beginPath();
    ctx.moveTo(px + DX[v.dir] * this.cs * 0.45, py + DY[v.dir] * this.cs * 0.45);
    ctx.lineTo(end.px, end.py);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  private puff(x: number, y: number, n: number): void {
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * this.cs * 0.3, y: y + (Math.random() - 0.5) * this.cs * 0.3,
        vx: (Math.random() - 0.5) * 40, vy: -10 - Math.random() * 30, life: 0, max: 0.45 + Math.random() * 0.2,
        color: 'rgba(255,255,255,0.85)', size: this.cs * (0.1 + Math.random() * 0.1), kind: 'dust', rot: 0, vr: 0,
      });
    }
  }

  private drawParticles(dt: number): void {
    const ctx = this.ctx;
    this.particles = this.particles.filter((p) => (p.life += dt) < p.max);
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      const k = 1 - p.life / p.max;
      if (p.kind === 'dust') {
        p.vx *= 0.95;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = k * 0.8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.4 - k * 0.6), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'confetti') {
        p.vx += Math.sin(p.rot) * 20 * dt;
        ctx.globalAlpha = Math.min(1, k * 3);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      } else {
        p.vy += 300 * dt;
        ctx.globalAlpha = k;
        ctx.fillStyle = p.color;
        drawStar(ctx, p.x, p.y, p.size, p.rot);
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawBoardCache(): void {
    const st = this.state!;
    const { w, h, mask } = st.level;
    const b = this.board;
    b.width = this.canvas.width;
    b.height = this.canvas.height;
    const ctx = b.getContext('2d')!;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const cs = this.cs, th = this.theme;
    const pad = cs * 0.14;

    // rug backing: one union path (rounded cells + bridges) so seams don't show notches
    const rug = (dy: number) => {
      ctx.beginPath();
      const r = cs * 0.3;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (!mask[idx(w, x, y)]) continue;
        const px = this.ox + x * cs, py = this.oy + y * cs + dy;
        addRoundRect(ctx, px - pad, py - pad, cs + pad * 2, cs + pad * 2, r);
        const right = x + 1 < w && mask[idx(w, x + 1, y)];
        const down = y + 1 < h && mask[idx(w, x, y + 1)];
        if (right) ctx.rect(px + cs / 2, py - pad, cs, cs + pad * 2);
        if (down) ctx.rect(px - pad, py + cs / 2, cs + pad * 2, cs);
        if (right && down && mask[idx(w, x + 1, y + 1)]) ctx.rect(px + cs / 2, py + cs / 2, cs, cs);
      }
      ctx.fill('nonzero');
    };
    ctx.fillStyle = 'rgba(70, 35, 20, 0.15)';
    rug(cs * 0.1);
    ctx.fillStyle = th.board;
    rug(0);
    // cushions
    const ins = cs * 0.05;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!mask[idx(w, x, y)]) continue;
      const px = this.ox + x * cs + ins, py = this.oy + y * cs + ins, s = cs - ins * 2;
      ctx.fillStyle = th.tileEdge;
      roundRect(ctx, px, py + cs * 0.05, s, s, cs * 0.2);
      ctx.fill();
      ctx.fillStyle = (x + y) % 2 ? th.tileB : th.tileA;
      roundRect(ctx, px, py, s, s, cs * 0.2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      roundRect(ctx, px + s * 0.12, py + s * 0.08, s * 0.5, s * 0.12, s * 0.06);
      ctx.fill();
    }
  }
}

function easeOutBack(t: number): number {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  addRoundRect(ctx, x, y, w, h, r);
}

/** Adds a clockwise rounded-rect subpath (same winding as ctx.rect, so unions fill cleanly). */
function addRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = rot + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}
