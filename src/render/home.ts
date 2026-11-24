import { COATS, drawCat, drawSleepy } from './cat';

interface HomeCat {
  /** position as a fraction of the canvas */
  fx: number;
  fy: number;
  /** size as a fraction of the canvas height */
  fs: number;
  coat: number;
  sleepy: boolean;
  phase: number;
  jumpAt: number;
  awakeUntil: number;
  blinkAt: number;
  lookAt: number;
  look: number;
}

interface Heart { x: number; y: number; vx: number; vy: number; life: number; s: number }

/**
 * The living cat scene on the home screen. Cats breathe, blink, look around and react to taps,
 * so the first screen already feels like the game.
 */
export class HomeScene {
  private ctx: CanvasRenderingContext2D;
  private W = 0;
  private H = 0;
  private dpr = 1;
  private running = false;
  private hearts: Heart[] = [];
  private last = performance.now();
  private cats: HomeCat[] = [
    { fx: 0.5, fy: 0.58, fs: 0.7, coat: 0, sleepy: false, phase: 0, jumpAt: -1e9, awakeUntil: 0, blinkAt: 1500, lookAt: 2500, look: 0 },
    { fx: 0.16, fy: 0.8, fs: 0.36, coat: 1, sleepy: true, phase: 1.3, jumpAt: -1e9, awakeUntil: 0, blinkAt: 0, lookAt: 0, look: 0 },
    { fx: 0.85, fy: 0.78, fs: 0.38, coat: 5, sleepy: false, phase: 2.1, jumpAt: -1e9, awakeUntil: 0, blinkAt: 3200, lookAt: 1800, look: 0 },
  ];

  constructor(private canvas: HTMLCanvasElement, private onTap: (kind: 'meow' | 'wake', coat: number) => void) {
    this.ctx = canvas.getContext('2d')!;
    new ResizeObserver(() => this.resize()).observe(canvas);
    canvas.addEventListener('pointerdown', (e) => this.tap(e));
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.resize();
    const loop = (now: number) => {
      if (!this.running) return;
      this.frame(now);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
  }

  private resize(): void {
    const r = this.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.W = r.width;
    this.H = r.height;
    this.canvas.width = Math.round(r.width * this.dpr);
    this.canvas.height = Math.round(r.height * this.dpr);
  }

  private pos(c: HomeCat): { x: number; y: number; s: number } {
    const s = Math.min(this.H * c.fs, this.W * 0.62 * (c.fs / 0.78));
    return { x: this.W * c.fx, y: this.H * c.fy, s };
  }

  private tap(e: PointerEvent): void {
    const r = this.canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const now = performance.now();
    // front-most (largest) cat wins
    for (const c of [...this.cats].sort((a, b) => b.fs - a.fs)) {
      const p = this.pos(c);
      if (Math.hypot(x - p.x, y - p.y) > p.s * 0.45) continue;
      if (c.sleepy && now > c.awakeUntil) {
        c.awakeUntil = now + 2500;
        this.onTap('wake', c.coat);
      } else {
        c.jumpAt = now;
        this.onTap('meow', c.coat);
      }
      for (let i = 0; i < 6; i++) {
        this.hearts.push({
          x: p.x + (Math.random() - 0.5) * p.s * 0.4, y: p.y - p.s * 0.3,
          vx: (Math.random() - 0.5) * 60, vy: -60 - Math.random() * 60, life: 0, s: 8 + Math.random() * 8,
        });
      }
      return;
    }
  }

  private frame(now: number): void {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.W, this.H);

    // cushion the cats sit on
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.ellipse(this.W / 2, this.H * 0.9, this.W * 0.46, this.H * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();

    for (const c of [...this.cats].sort((a, b) => a.fy - b.fy || a.fs - b.fs)) {
      const p = this.pos(c);
      const t = now / 1000 + c.phase;
      const jt = (now - c.jumpAt) / 520;
      const jump = jt >= 0 && jt < 1 ? Math.sin(jt * Math.PI) : 0;
      const y = p.y - jump * p.s * 0.35;
      if (c.sleepy && now > c.awakeUntil) {
        drawSleepy(ctx, COATS[c.coat], p.x, y, p.s, t, 1);
        continue;
      }
      if (now > c.blinkAt + 150) c.blinkAt = now + 1800 + Math.random() * 3500;
      if (now > c.lookAt) {
        c.look = c.look === 0 ? (Math.random() < 0.5 ? -0.22 : 0.22) : 0;
        c.lookAt = now + 1200 + Math.random() * 2500;
      }
      drawCat(ctx, COATS[c.coat], {
        x: p.x, y, s: p.s, angle: c.look, stretch: 1 + jump * 0.12,
        scale: 1 + Math.sin(t * 1.6) * 0.02, blink: now > c.blinkAt && now < c.blinkAt + 150,
        dizzy: false, hurt: 0, tail: Math.sin(t * (jump ? 9 : 1.8)) * 0.4, running: jump ? 1 : 0,
      });
    }

    this.hearts = this.hearts.filter((h) => (h.life += dt) < 1);
    for (const h of this.hearts) {
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      ctx.globalAlpha = 1 - h.life;
      drawHeart(ctx, h.x, h.y, h.s * (0.6 + h.life * 0.6));
    }
    ctx.globalAlpha = 1;
  }
}

function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.fillStyle = '#ff5d73';
  ctx.strokeStyle = '#4a3530';
  ctx.lineWidth = Math.max(1.5, s * 0.15);
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x - s, y - s * 0.3, x - s * 0.4, y - s, x, y - s * 0.4);
  ctx.bezierCurveTo(x + s * 0.4, y - s, x + s, y - s * 0.3, x, y + s * 0.35);
  ctx.fill();
  ctx.stroke();
}
