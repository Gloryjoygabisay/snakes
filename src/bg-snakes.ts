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

/** A single large cute snake that bounces DVD-logo style around the canvas. */
interface BounceSnake {
  segs: Seg[];       // position trail — head is segs[0]
  vx: number;        // velocity x (px/frame)
  vy: number;        // velocity y (px/frame)
  r: number;         // head radius
  bodyColor: string;
  headColor: string;
  t: number;         // local timer (for tongue flick / eye blink)
  scaleY: number;    // squeeze on bounce (1 = normal)
  squeezeMs: number; // countdown for squeeze animation
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

function colorVariant(hex: string, f: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.floor(((n >> 16) & 0xff) * f));
  const g = Math.min(255, Math.floor(((n >>  8) & 0xff) * f));
  const b = Math.min(255, Math.floor(( n        & 0xff) * f));
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

// Brightness factors applied per-snake so each snake is a unique shade of the chosen color
const BODY_FACTORS  = [1.0, 0.75, 1.35, 0.60, 1.2, 0.90, 1.1, 0.80, 1.30, 0.70];
const HEAD_FACTORS  = [1.3, 1.05, 1.60, 0.85, 1.5, 1.15, 1.3, 1.05, 1.55, 0.90];

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

function drawBounceSnake(ctx: CanvasRenderingContext2D, s: BounceSnake): void {
  const n = s.segs.length;
  if (n < 2) return;

  const dx  = s.segs[0].x - s.segs[1].x;
  const dy  = s.segs[0].y - s.segs[1].y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const fwd  = { x: dx / len, y: dy / len };
  const perp = { x: -fwd.y,  y: fwd.x  };

  const squeeze = s.scaleY; // < 1 = squished on bounce

  ctx.save();
  ctx.translate(s.segs[0].x, s.segs[0].y);
  ctx.scale(1, squeeze);
  ctx.translate(-s.segs[0].x, -s.segs[0].y);

  // Draw body tail → head
  for (let i = n - 1; i >= 0; i--) {
    const seg  = s.segs[i];
    const t    = i / (n - 1);               // 0 = head, 1 = tail
    const r    = s.r * (1 - t * 0.52);      // taper
    const alpha = 0.92 - t * 0.30;

    // Connect to previous segment with a filled quad
    if (i > 0) {
      const prev = s.segs[i - 1];
      const bdx = prev.x - seg.x;
      const bdy = prev.y - seg.y;
      const bl  = Math.sqrt(bdx * bdx + bdy * bdy) || 1;
      const bnx =  bdy / bl;
      const bny = -bdx / bl;
      // Alternating stripe pattern
      const stripe = i % 3 === 0
        ? s.headColor
        : i % 3 === 1 ? s.bodyColor : darken(s.bodyColor, 0.72);
      ctx.fillStyle  = stripe;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(seg.x  + bnx * r, seg.y  + bny * r);
      ctx.lineTo(prev.x + bnx * r, prev.y + bny * r);
      ctx.lineTo(prev.x - bnx * r, prev.y - bny * r);
      ctx.lineTo(seg.x  - bnx * r, seg.y  - bny * r);
      ctx.closePath();
      ctx.fill();
    }

    // Rounded segment circle
    const col = i === 0
      ? s.headColor
      : (i % 3 === 0 ? s.headColor : i % 3 === 1 ? s.bodyColor : darken(s.bodyColor, 0.72));
    ctx.fillStyle  = col;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(seg.x, seg.y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Big cute eyes ──────────────────────────────────────────────────────────
  const head = s.segs[0];
  const eyeR = s.r * 0.38;
  const eOff = s.r * 0.44;
  for (const side of [-1, 1]) {
    const ex = head.x + fwd.x * eOff * 0.7 + perp.x * eOff * side;
    const ey = head.y + fwd.y * eOff * 0.7 + perp.y * eOff * side;
    // White sclera with outline
    ctx.fillStyle  = '#ffffff';
    ctx.globalAlpha = 0.97;
    ctx.beginPath(); ctx.arc(ex, ey, eyeR, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth   = 1.2;
    ctx.stroke();
    // Coloured iris
    ctx.fillStyle  = '#2d1aad';
    ctx.globalAlpha = 0.90;
    ctx.beginPath(); ctx.arc(ex + fwd.x * eyeR * 0.25, ey + fwd.y * eyeR * 0.25, eyeR * 0.60, 0, Math.PI * 2); ctx.fill();
    // Pupil
    ctx.fillStyle = '#000';
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(ex + fwd.x * eyeR * 0.30, ey + fwd.y * eyeR * 0.30, eyeR * 0.30, 0, Math.PI * 2); ctx.fill();
    // Glint
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.arc(ex + fwd.x * eyeR * 0.10 - perp.x * eyeR * 0.18 * side, ey + fwd.y * eyeR * 0.10 - perp.y * eyeR * 0.18 * side, eyeR * 0.18, 0, Math.PI * 2); ctx.fill();
  }

  // ── Forked tongue (flicks every ~1.2 s) ───────────────────────────────────
  const tonguePhase = (s.t % 1.2);
  if (tonguePhase < 0.22) {
    const prog      = tonguePhase / 0.22;
    const tLen      = s.r * 1.8 * Math.sin(prog * Math.PI);
    const forked    = s.r * 0.60;
    const tx = head.x + fwd.x * (s.r + tLen * 0.55);
    const ty = head.y + fwd.y * (s.r + tLen * 0.55);
    ctx.strokeStyle  = '#ff44aa';
    ctx.lineWidth    = Math.max(1.2, s.r * 0.16);
    ctx.globalAlpha  = 0.88;
    ctx.lineCap      = 'round';
    ctx.beginPath();
    ctx.moveTo(head.x + fwd.x * s.r * 0.9, head.y + fwd.y * s.r * 0.9);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx + fwd.x * forked + perp.x * forked * 0.75, ty + fwd.y * forked + perp.y * forked * 0.75);
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx + fwd.x * forked - perp.x * forked * 0.75, ty + fwd.y * forked - perp.y * forked * 0.75);
    ctx.stroke();
  }

  ctx.restore();
  ctx.globalAlpha = 1;
}

export function startBgAnimation(canvas: HTMLCanvasElement): { stop: () => void; setColors: (body: string, head: string) => void } {
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
    makeSnake(-80,        H()*0.15, 0.15,         '#e74c3c', '#ff6b6b', 20, 2.0, 0.55, 0.40, 0.0, 22),
    makeSnake(W()+80,     H()*0.60, Math.PI-0.2,  '#00ff88', '#66ffbb', 18, 1.7, 0.65, 0.45, 2.0, 20),
    makeSnake(-80,        H()*0.82, 0.05,          '#f1c40f', '#ffeaa7', 17, 1.5, 0.75, 0.50, 4.0, 19),
    makeSnake(W()+80,     H()*0.38, Math.PI+0.1,  '#6c5ce7', '#a29bfe', 17, 1.6, 0.60, 0.42, 1.2, 18),
    makeSnake(-80,        H()*0.50, -0.1,          '#00ff88', '#55efc4', 16, 1.3, 0.85, 0.38, 3.0, 17),
    makeSnake(W()+80,     H()*0.22, Math.PI+0.05, '#e84393', '#fd79a8', 15, 1.4, 0.70, 0.35, 5.5, 16),
    makeSnake(W()*0.50,  -80,       Math.PI*0.5,  '#3498db', '#74b9ff', 19, 1.8, 0.60, 0.42, 1.5, 21),
    makeSnake(W()*0.25,  H()+80,   -Math.PI*0.5,  '#00ff88', '#b3ffe0', 16, 1.6, 0.70, 0.48, 6.0, 18),
    makeSnake(W()*0.75,  -80,       Math.PI*0.55, '#fd9644', '#ffc870', 18, 1.9, 0.50, 0.36, 2.5, 20),
    makeSnake(W()*0.50,  H()+80,   -Math.PI*0.6,  '#00cc66', '#55ffc4', 15, 1.4, 0.80, 0.44, 4.8, 17),
  ];

  // ── Bouncing star snake (DVD logo style) ────────────────────────────────────
  const BOUNCE_R    = 22;
  const BOUNCE_SEGS = 18;
  const BOUNCE_SPD  = 2.8;   // px per frame
  const bounceAngle = 0.72;  // initial travel angle (not axis-aligned → looks nicer)
  const bouncerSegs: Seg[] = [];
  for (let i = 0; i < BOUNCE_SEGS; i++) {
    bouncerSegs.push({
      x: W() * 0.5 - Math.cos(bounceAngle) * i * BOUNCE_R * SEG_SPACING,
      y: H() * 0.5 - Math.sin(bounceAngle) * i * BOUNCE_R * SEG_SPACING,
    });
  }
  const bouncer: BounceSnake = {
    segs: bouncerSegs,
    vx: Math.cos(bounceAngle) * BOUNCE_SPD,
    vy: Math.sin(bounceAngle) * BOUNCE_SPD,
    r: BOUNCE_R,
    bodyColor: '#7CFF4F',
    headColor: '#FF5AAE',
    t: 0,
    scaleY: 1,
    squeezeMs: 0,
  };

  function setColors(body: string, head: string): void {
    snakes.forEach((s, i) => {
      s.color     = colorVariant(body, BODY_FACTORS[i] ?? 1.0);
      s.headColor = colorVariant(head, HEAD_FACTORS[i] ?? 1.3);
    });
  }

  let last = performance.now();

  function tick(now: number): void {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 0.05); // seconds, capped
    last = now;

    ctx.clearRect(0, 0, W(), H());
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(0, 0, W(), H());

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

    // ── Update + draw bouncing snake ────────────────────────────────────────
    bouncer.t += dt;
    if (bouncer.squeezeMs > 0) bouncer.squeezeMs = Math.max(0, bouncer.squeezeMs - dt * 1000);
    // Ease squeeze back to 1
    bouncer.scaleY = bouncer.squeezeMs > 0
      ? 1 - 0.38 * Math.sin((bouncer.squeezeMs / 220) * Math.PI)
      : 1;

    // Move head
    const bh = bouncer.segs[0];
    bh.x += bouncer.vx;
    bh.y += bouncer.vy;

    // Wall bounce (reflect velocity, trigger squeeze)
    const margin = bouncer.r * 0.9;
    let bounced = false;
    if (bh.x < margin)        { bh.x = margin;        bouncer.vx =  Math.abs(bouncer.vx); bounced = true; }
    if (bh.x > W() - margin)  { bh.x = W() - margin;  bouncer.vx = -Math.abs(bouncer.vx); bounced = true; }
    if (bh.y < margin)        { bh.y = margin;        bouncer.vy =  Math.abs(bouncer.vy); bounced = true; }
    if (bh.y > H() - margin)  { bh.y = H() - margin;  bouncer.vy = -Math.abs(bouncer.vy); bounced = true; }
    if (bounced) bouncer.squeezeMs = 220;

    // Follow chain
    for (let i = 1; i < bouncer.segs.length; i++) {
      const p = bouncer.segs[i - 1];
      const c = bouncer.segs[i];
      const ddx = c.x - p.x;
      const ddy = c.y - p.y;
      const dist = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
      const target = bouncer.r * SEG_SPACING * (1 - (i / bouncer.segs.length) * 0.30);
      if (dist > target) {
        c.x = p.x + (ddx / dist) * target;
        c.y = p.y + (ddy / dist) * target;
      }
    }

    drawBounceSnake(ctx, bouncer);

    animId = requestAnimationFrame(tick);
  }

  animId = requestAnimationFrame(tick);

  return {
    stop: () => {
      running = false;
      cancelAnimationFrame(animId);
      ro?.disconnect();
    },
    setColors,
  };
}
