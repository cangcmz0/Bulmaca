export interface Coat {
  body: string;
  shade: string;
  eye: string;
  pattern: 'none' | 'stripes' | 'patches' | 'mask';
  patternColor: string;
}

export const OUTLINE = '#4a3530';

export const COATS: Coat[] = [
  { body: '#f6a85b', shade: '#e08a3c', eye: '#2e2420', pattern: 'stripes', patternColor: '#e07f2e' }, // ginger
  { body: '#a9b4c2', shade: '#8995a5', eye: '#2e2420', pattern: 'stripes', patternColor: '#7f8b9b' }, // grey tabby
  { body: '#f7ead2', shade: '#e6d3b1', eye: '#2e2420', pattern: 'mask', patternColor: '#9c7a62' }, // siamese
  { body: '#45404a', shade: '#332f37', eye: '#f2d14b', pattern: 'none', patternColor: '#45404a' }, // black
  { body: '#fdfbf7', shade: '#e9e4dc', eye: '#3a7bd5', pattern: 'none', patternColor: '#fdfbf7' }, // white
  { body: '#fdfbf7', shade: '#e9e4dc', eye: '#2e2420', pattern: 'patches', patternColor: '#f29b4b' }, // calico
];

export interface CatPose {
  /** centre in px */
  x: number;
  y: number;
  /** cell size in px */
  s: number;
  /** radians; 0 = facing up */
  angle: number;
  /** squash/stretch along facing axis */
  stretch: number;
  scale: number;
  blink: boolean;
  dizzy: boolean;
  /** 0..1 red tint after a bump */
  hurt: number;
  /** tail sway radians */
  tail: number;
  /** legs out while running */
  running: number;
  /** scared cat: sweat drop and worried brows */
  sweat?: boolean;
}

/** Draws a top-down cat facing "up" in local space, then rotated by pose.angle. */
export function drawCat(ctx: CanvasRenderingContext2D, coat: Coat, p: CatPose): void {
  const s = p.s * p.scale;
  const lw = Math.max(1.5, s * 0.045);
  ctx.save();
  ctx.translate(p.x, p.y);

  // ground shadow (not rotated so light stays consistent)
  ctx.fillStyle = 'rgba(80, 40, 20, 0.16)';
  ctx.beginPath();
  ctx.ellipse(0, s * 0.3, s * 0.3, s * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.rotate(p.angle);
  ctx.scale(1 / Math.sqrt(p.stretch), p.stretch);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = lw;

  // legs (only visible while running)
  if (p.running > 0) {
    ctx.fillStyle = coat.shade;
    const k = p.running;
    for (const [lx, ly, ph] of [[-0.2, -0.02, 0], [0.2, -0.02, Math.PI], [-0.18, 0.3, Math.PI], [0.18, 0.3, 0]] as const) {
      const off = Math.sin(performance.now() / 45 + ph) * 0.08 * k;
      ctx.beginPath();
      ctx.ellipse((lx + Math.sign(lx) * 0.05 * k) * s, (ly + off) * s, s * 0.07, s * 0.09, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  // tail
  ctx.save();
  ctx.translate(0, s * 0.36);
  ctx.rotate(p.tail);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(s * 0.02, s * 0.14, s * 0.22, s * 0.14, s * 0.2, s * 0.02);
  ctx.lineWidth = s * 0.12 + lw * 2;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  ctx.lineWidth = s * 0.12;
  ctx.strokeStyle = coat.body;
  ctx.stroke();
  ctx.restore();
  ctx.lineWidth = lw;
  ctx.strokeStyle = OUTLINE;

  // body
  ctx.fillStyle = coat.body;
  ctx.beginPath();
  ctx.ellipse(0, s * 0.14, s * 0.25, s * 0.27, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = coat.shade;
  ctx.beginPath();
  ctx.ellipse(s * 0.1, s * 0.24, s * 0.22, s * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  if (coat.pattern === 'stripes') {
    ctx.strokeStyle = coat.patternColor;
    ctx.lineWidth = s * 0.05;
    for (const yy of [0.06, 0.17, 0.28]) {
      ctx.beginPath();
      ctx.moveTo(-s * 0.3, s * yy);
      ctx.quadraticCurveTo(0, s * (yy - 0.05), s * 0.3, s * yy);
      ctx.stroke();
    }
  } else if (coat.pattern === 'patches') {
    ctx.fillStyle = coat.patternColor;
    ctx.beginPath();
    ctx.ellipse(-s * 0.12, s * 0.2, s * 0.12, s * 0.1, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4b3f45';
    ctx.beginPath();
    ctx.ellipse(s * 0.13, s * 0.05, s * 0.08, s * 0.07, -0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.ellipse(0, s * 0.14, s * 0.25, s * 0.27, 0, 0, Math.PI * 2);
  ctx.stroke();

  // ears
  const hy = -s * 0.16;
  for (const side of [-1, 1]) {
    ctx.fillStyle = coat.pattern === 'mask' ? coat.patternColor : coat.body;
    ctx.beginPath();
    ctx.moveTo(side * s * 0.07, hy - s * 0.17);
    ctx.lineTo(side * s * 0.25, hy - s * 0.28);
    ctx.lineTo(side * s * 0.23, hy - s * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f4a6a6';
    ctx.beginPath();
    ctx.moveTo(side * s * 0.11, hy - s * 0.16);
    ctx.lineTo(side * s * 0.22, hy - s * 0.23);
    ctx.lineTo(side * s * 0.21, hy - s * 0.09);
    ctx.closePath();
    ctx.fill();
  }

  // head
  ctx.fillStyle = coat.body;
  ctx.beginPath();
  ctx.ellipse(0, hy, s * 0.24, s * 0.21, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.clip();
  if (coat.pattern === 'mask') {
    ctx.fillStyle = coat.patternColor;
    ctx.beginPath();
    ctx.ellipse(0, hy + s * 0.05, s * 0.13, s * 0.11, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (coat.pattern === 'stripes') {
    ctx.strokeStyle = coat.patternColor;
    ctx.lineWidth = s * 0.04;
    for (const xx of [-0.06, 0, 0.06]) {
      ctx.beginPath();
      ctx.moveTo(s * xx, hy - s * 0.22);
      ctx.lineTo(s * xx * 0.7, hy - s * 0.12);
      ctx.stroke();
    }
  } else if (coat.pattern === 'patches') {
    ctx.fillStyle = coat.patternColor;
    ctx.beginPath();
    ctx.ellipse(-s * 0.14, hy - s * 0.1, s * 0.12, s * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.ellipse(0, hy, s * 0.24, s * 0.21, 0, 0, Math.PI * 2);
  ctx.stroke();

  // eyes
  const ey = hy - s * 0.03;
  for (const side of [-1, 1]) {
    const ex = side * s * 0.095;
    if (p.dizzy) {
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = lw * 1.1;
      const r = s * 0.035;
      ctx.beginPath();
      ctx.moveTo(ex - r, ey - r); ctx.lineTo(ex + r, ey + r);
      ctx.moveTo(ex + r, ey - r); ctx.lineTo(ex - r, ey + r);
      ctx.stroke();
    } else if (p.blink) {
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.arc(ex, ey - s * 0.01, s * 0.035, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    } else {
      ctx.fillStyle = coat.eye;
      ctx.beginPath();
      ctx.ellipse(ex, ey, s * 0.045, s * 0.055, 0, 0, Math.PI * 2);
      ctx.fill();
      if (coat.eye !== '#2e2420') {
        ctx.fillStyle = '#1d1715';
        ctx.beginPath();
        ctx.ellipse(ex, ey, s * 0.017, s * 0.045, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(ex + s * 0.015, ey - s * 0.02, s * 0.016, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // nose + mouth
  ctx.fillStyle = '#f08a8a';
  ctx.beginPath();
  ctx.moveTo(-s * 0.025, hy + s * 0.045);
  ctx.lineTo(s * 0.025, hy + s * 0.045);
  ctx.lineTo(0, hy + s * 0.075);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = lw * 0.7;
  ctx.beginPath();
  ctx.moveTo(0, hy + s * 0.075);
  ctx.quadraticCurveTo(-s * 0.03, hy + s * 0.11, -s * 0.055, hy + s * 0.085);
  ctx.moveTo(0, hy + s * 0.075);
  ctx.quadraticCurveTo(s * 0.03, hy + s * 0.11, s * 0.055, hy + s * 0.085);
  ctx.stroke();

  // cheeks
  ctx.fillStyle = 'rgba(244, 140, 140, 0.35)';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * s * 0.15, hy + s * 0.06, s * 0.035, s * 0.022, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  if (p.sweat) {
    // worried brows
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = lw * 0.9;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * s * 0.05, ey - s * 0.08);
      ctx.lineTo(side * s * 0.14, ey - s * 0.11);
      ctx.stroke();
    }
    // sweat drop
    const dx = s * 0.27, dy = hy - s * 0.12;
    ctx.fillStyle = '#5bb8ff';
    ctx.beginPath();
    ctx.moveTo(dx, dy - s * 0.14);
    ctx.quadraticCurveTo(dx + s * 0.1, dy, dx, dy + s * 0.06);
    ctx.quadraticCurveTo(dx - s * 0.1, dy, dx, dy - s * 0.14);
    ctx.fill();
    ctx.lineWidth = lw * 0.7;
    ctx.stroke();
  }

  if (p.hurt > 0) {
    ctx.fillStyle = `rgba(255, 70, 70, ${0.4 * p.hurt})`;
    ctx.beginPath();
    ctx.ellipse(0, s * 0.14, s * 0.25, s * 0.27, 0, 0, Math.PI * 2);
    ctx.ellipse(0, hy, s * 0.24, s * 0.21, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/** A sleepy cat curled into a ball: no head direction visible, a "z" floats up. */
export function drawSleepy(ctx: CanvasRenderingContext2D, coat: Coat, x: number, y: number, size: number, t: number, scale: number): void {
  const s = size * scale;
  const lw = Math.max(1.5, s * 0.045);
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(80, 40, 20, 0.16)';
  ctx.beginPath();
  ctx.ellipse(0, s * 0.26, s * 0.32, s * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = lw;
  const breathe = 1 + Math.sin(t * 2.2) * 0.03;
  // body ball
  ctx.fillStyle = coat.body;
  ctx.beginPath();
  ctx.ellipse(0, s * 0.03, s * 0.31 * breathe, s * 0.27 * breathe, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // tail wrapped around the front
  ctx.lineWidth = s * 0.1 + lw * 2;
  ctx.beginPath();
  ctx.arc(0, s * 0.03, s * 0.25, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  ctx.strokeStyle = coat.pattern === 'mask' ? coat.patternColor : coat.shade;
  ctx.lineWidth = s * 0.1;
  ctx.stroke();
  // tucked head with closed eyes
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = lw;
  ctx.fillStyle = coat.body;
  ctx.beginPath();
  ctx.ellipse(-s * 0.06, -s * 0.04, s * 0.16, s * 0.13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  for (const ex of [-0.12, -0.01]) {
    ctx.beginPath();
    ctx.arc(s * ex, -s * 0.05, s * 0.03, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
  }
  // ears flat
  ctx.fillStyle = coat.pattern === 'mask' ? coat.patternColor : coat.body;
  for (const ex of [-0.17, 0.04]) {
    ctx.beginPath();
    ctx.moveTo(s * ex, -s * 0.13);
    ctx.lineTo(s * (ex + 0.05), -s * 0.22);
    ctx.lineTo(s * (ex + 0.1), -s * 0.13);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // floating z
  const zp = (t * 0.6) % 1;
  ctx.globalAlpha = Math.sin(zp * Math.PI);
  ctx.fillStyle = '#ffffff';
  ctx.font = `600 ${Math.max(10, s * (0.18 + zp * 0.1))}px Fredoka, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.lineWidth = Math.max(2, s * 0.03);
  ctx.strokeText('z', s * (0.2 + zp * 0.12), -s * (0.2 + zp * 0.25));
  ctx.fillText('z', s * (0.2 + zp * 0.12), -s * (0.2 + zp * 0.25));
  ctx.globalAlpha = 1;
  ctx.restore();
}

/** Two curved arrows circling a spin cat so players know it turns. */
export function drawSpinRing(ctx: CanvasRenderingContext2D, x: number, y: number, cs: number, t: number, color: string): void {
  const r = cs * 0.44;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(t * 1.6);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = Math.max(2, cs * 0.05);
  ctx.lineCap = 'round';
  for (let i = 0; i < 2; i++) {
    const a0 = i * Math.PI + 0.25, a1 = a0 + Math.PI * 0.6;
    ctx.beginPath();
    ctx.arc(0, 0, r, a0, a1);
    ctx.stroke();
    const hx = Math.cos(a1) * r, hy = Math.sin(a1) * r;
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(a1 + Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(cs * 0.08, 0);
    ctx.lineTo(-cs * 0.04, -cs * 0.06);
    ctx.lineTo(-cs * 0.04, cs * 0.06);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}
