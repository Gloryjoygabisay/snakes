/** Animated real-snake background drawn on a canvas. */

interface Seg { x: number; y: number; }

interface BgSnake {
  segs: Seg[];
  color: string;
  headColor: string;
  r: number;       // head radius
  speed: number;
  angle: number;   // radians
  waveFreq: number;
  waveAmp: number;
  t: number;       // per-snake time offset
}

const SEG_SPACING = 1.2; // multiplier of radius

function hexToRgba(hex: string, a: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 0xff},${(n >> 8) & 0xff},${n & 0xff},${a})`;
}

function darken(hex: string, f: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.floor(((n >> 16) & 0xff) * f);
  const g = Math.floor(((n >>  8) & 0xff) * f);
  const b = Math.floor(( n        & 0xff) * f);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

function makeSnake(
  x: number, y: number, angle: number,
  color: string, headColor: string,
  r: number, speed: number,
  wFreq: number, wAmp: number, tOff: number,
  numSegs: number,
): BgSnake {
  const segs: Seg[] = [];
  for (let i = 0; i < numSegs; i++) {
    segs.push({
      x: x - Math.cos(angle) * i * r * SEG_SPACING,
      y: y - Math.sin(angle) * i * r * SEG_SPACING,
    });
  }
  return { segs, color, headColor, r, speed, angle, waveFreq: wFreq, waveAmp: wAmp, t: tOff };
}

function drawSnake(ctx: CanvasRenderingContext2D, s: BgSnake): void {
  const n = s.segs.length;
  if (n < 2) return;

  // Direction vector (head → body[1])
  const dx = s.segs[0].x - s.segs[1].x;
  const dy = s.segs[0].y - s.segs[1].y;
  const dLen = Math.sqrt(dx * dx + dy * dy) || 1;
  const fwd  = { x: dx / dLen, y: dy / dLen };
  const perp = { x: -fwd.y,   y:  fwd.x    };

  // Draw from tail → head so head is on top
  for (let i = n - 1; i >= 0; i--) {
    const seg  = s.segs[i];
    const t    = i / (n - 1);               // 0 = head, 1 = tail
    const r    = s.r * (1 - t * 0.55);      // taper
    const alpha = 0.8 - t * 0.45;

    // Connecting bridge to next (toward head)
    if (i > 0) {
      const prev = s.segs[i - 1];
      const bdx = prev.x - seg.x;
      const bdy = prev.y - seg.y;
      const bl  = Math.sqrt(bdx * bdx + bdy * bdy) || 1;
      const bnx =  bdy / bl;
      const bny = -bdx / bl;
      const col  = i % 2 === 0 ? s.color : darken(s.color, 0.75);
      ctx.fillStyle = col;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(seg.x  + bnx * r, seg.y  + bny * r);
      ctx.lineTo(prev.x + bnx * r, prev.y + bny * r);
      ctx.lineTo(prev.x - bnx * r, prev.y - bny * r);
      ctx.lineTo(seg.x  - bnx * r, seg.y  - bny * r);
      ctx.closePath();
      ctx.fill();
    }

    // Body circle
    const col = i === 0 ? s.headColor : (i % 2 === 0 ? s.color : darken(s.color, 0.75));
    ctx.fillStyle = col;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(seg.x, seg.y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Eyes
  const head  = s.segs[0];
  const eyeR  = s.r * 0.3;
  const eOff  = s.r * 0.38;
  for (const side of [-1, 1]) {
    const ex = head.x + fwd.x * eOff + perp.x * eOff * side;
    const ey = head.y + fwd.y * eOff + perp.y * eOff * side;
    // sclera
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    ctx.arc(ex, ey, eyeR, 0, Math.PI * 2);
    ctx.fill();
    // pupil
    ctx.fillStyle = '#111';
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(ex + fwd.x * eyeR * 0.35, ey + fwd.y * eyeR * 0.35, eyeR * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }

  // Tongue (flicks from head)
  const tongueLen = s.r * 1.6;
  const forked    = s.r * 0.55;
  const tx = head.x + fwd.x * (s.r + tongueLen * 0.5);
  const ty = head.y + fwd.y * (s.r + tongueLen * 0.5);
  ctx.strokeStyle = hexToRgba('#ff69b4', 0.9);
  ctx.lineWidth   = Math.max(1, s.r * 0.18);
  ctx.globalAlpha = 0.85;
  ctx.lineCap     = 'round';
  ctx.beginPath();
  ctx.moveTo(head.x + fwd.x * s.r, head.y + fwd.y * s.r);
  ctx.lineTo(tx, ty);
  ctx.moveTo(tx, ty);
  ctx.lineTo(tx + fwd.x * forked + perp.x * forked * 0.7, ty + fwd.y * forked + perp.y * forked * 0.7);
  ctx.moveTo(tx, ty);
  ctx.lineTo(tx + fwd.x * forked - perp.x * forked * 0.7, ty + fwd.y * forked - perp.y * forked * 0.7);
  ctx.stroke();

  ctx.globalAlpha = 1;
}

export function startBgAnimation(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext('2d')!;
  let running = true;
  let animId  = 0;

  function resize(): void {
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }

  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  ro?.observe(canvas);
  resize();

  const W = () => canvas.width;
  const H = () => canvas.height;

  // Build snakes after first resize tick so W/H are valid
  const snakes: BgSnake[] = [
    makeSnake(-80,  H()*0.15, 0.15,    '#e74c3c', '#ff6b6b', 11, 2.0, 0.55, 0.40, 0,   20),
    makeSnake(W()+80, H()*0.60, Math.PI-0.2, '#3498db', '#74b9ff', 10, 1.7, 0.65, 0.45, 2.0, 18),
    makeSnake(-80,  H()*0.82, 0.05,    '#00b894', '#55efc4', 9,  1.5, 0.75, 0.50, 4.0, 16),
    makeSnake(W()+80, H()*0.38, Math.PI+0.1, '#6c5ce7', '#a29bfe', 9,  1.6, 0.60, 0.42, 1.2, 15),
    makeSnake(-80,  H()*0.50, -0.1,   '#f1c40f', '#ffeaa7', 8,  1.3, 0.85, 0.38, 3.0, 14),
    makeSnake(W()+80, H()*0.22, Math.PI+0.05, '#e84393', '#fd79a8', 7,  1.4, 0.70, 0.35, 5.5, 13),
  ];

  let last = performance.now();

  function tick(now: number): void {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 0.05); // seconds, capped
    last = now;

    ctx.clearRect(0, 0, W(), H());

    for (const s of snakes) {
      s.t += dt;
      // Sinusoidal angle drift → wavy motion
      s.angle += Math.sin(s.t * s.waveFreq) * s.waveAmp * dt * 3;

      // Move head
      const head = s.segs[0];
      head.x += Math.cos(s.angle) * s.speed;
      head.y += Math.sin(s.angle) * s.speed;

      // Follow chain with fixed spacing
      for (let i = 1; i < s.segs.length; i++) {
        const p = s.segs[i - 1];
        const c = s.segs[i];
        const ddx = c.x - p.x;
        const ddy = c.y - p.y;
        const dist = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
        const target = s.r * SEG_SPACING;
        if (dist > target) {
          c.x = p.x + (ddx / dist) * target;
          c.y = p.y + (ddy / dist) * target;
        }
      }

      // Wrap fully off-screen snakes back to opposite edge
      const margin = s.segs.length * s.r * SEG_SPACING + 40;
      if (head.x < -margin)      head.x = W() + margin * 0.3;
      if (head.x > W() + margin) head.x = -margin * 0.3;
      if (head.y < -margin)      head.y = H() + margin * 0.3;
      if (head.y > H() + margin) head.y = -margin * 0.3;

      drawSnake(ctx, s);
    }

    animId = requestAnimationFrame(tick);
  }

  animId = requestAnimationFrame(tick);

  return () => {
    running = false;
    cancelAnimationFrame(animId);
    ro?.disconnect();
  };
}
