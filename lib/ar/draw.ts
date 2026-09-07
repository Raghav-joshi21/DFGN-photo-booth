/**
 * Renders one face-tracked prop (see `FACE_LENSES` in `./index`) onto a
 * transparent canvas, anchored to a MediaPipe face mesh.
 *
 * Everything here is plain Canvas 2D — no images except the potato hat, which
 * reuses the site's existing art (`/art/potatoes.png`) rather than shipping a
 * new asset. Coordinates are in the *destination canvas's pixel space*; the
 * caller is responsible for sizing that canvas to the video frame and scaling
 * landmark positions accordingly (both handled by `geometry()` below, given
 * the canvas's own width/height).
 *
 * Landmark indices are the standard MediaPipe face-mesh topology (468 points,
 * plus 10 iris points this task always outputs) — stable across frames, so a
 * named index always means the same point on the face.
 */
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

const IDX = {
  eyeOuterA: 33,
  eyeOuterB: 263,
  eyeInnerA: 133,
  eyeInnerB: 362,
  noseTip: 1,
  chin: 152,
  foreheadTop: 10,
  mouthLeft: 61,
  mouthRight: 291,
  upperLip: 13,
  faceLeft: 234,
  faceRight: 454,
} as const;

interface Point {
  x: number;
  y: number;
}

interface FaceGeometry {
  eyeA: Point;
  eyeB: Point;
  eyeCenterA: Point;
  eyeCenterB: Point;
  eyeMid: Point;
  nose: Point;
  chin: Point;
  forehead: Point;
  upperLip: Point;
  mouthMid: Point;
  mouthWidth: number;
  faceWidth: number;
  eyeDist: number;
  /** Head tilt, in radians — the angle of the line between the outer eye corners. */
  roll: number;
}

function px(lm: NormalizedLandmark[], i: number, w: number, h: number): Point {
  const p = lm[i];
  return { x: p.x * w, y: p.y * h };
}

function dist(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function mid(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function geometry(lm: NormalizedLandmark[], w: number, h: number): FaceGeometry {
  const eyeA = px(lm, IDX.eyeOuterA, w, h);
  const eyeB = px(lm, IDX.eyeOuterB, w, h);
  const eyeCenterA = mid(eyeA, px(lm, IDX.eyeInnerA, w, h));
  const eyeCenterB = mid(eyeB, px(lm, IDX.eyeInnerB, w, h));
  const mouthL = px(lm, IDX.mouthLeft, w, h);
  const mouthR = px(lm, IDX.mouthRight, w, h);

  return {
    eyeA,
    eyeB,
    eyeCenterA,
    eyeCenterB,
    eyeMid: mid(eyeCenterA, eyeCenterB),
    nose: px(lm, IDX.noseTip, w, h),
    chin: px(lm, IDX.chin, w, h),
    forehead: px(lm, IDX.foreheadTop, w, h),
    upperLip: px(lm, IDX.upperLip, w, h),
    mouthMid: mid(mouthL, mouthR),
    mouthWidth: dist(mouthL, mouthR),
    faceWidth: dist(px(lm, IDX.faceLeft, w, h), px(lm, IDX.faceRight, w, h)),
    eyeDist: dist(eyeA, eyeB),
    roll: Math.atan2(eyeB.y - eyeA.y, eyeB.x - eyeA.x),
  };
}

function drawGooglyEyes(ctx: CanvasRenderingContext2D, g: FaceGeometry, nowMs: number) {
  const r = g.eyeDist * 0.24;

  [g.eyeCenterA, g.eyeCenterB].forEach((center, i) => {
    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.rotate(g.roll);

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.12);
    ctx.strokeStyle = "#222";
    ctx.stroke();

    // A little sinusoidal wobble per eye so the pupils drift independently —
    // that's the "googly" part.
    const wobbleX = Math.sin(nowMs / 260 + i * 2.4) * r * 0.28;
    const wobbleY = Math.cos(nowMs / 310 + i * 1.7) * r * 0.22;
    ctx.beginPath();
    ctx.arc(wobbleX, wobbleY, r * 0.42, 0, Math.PI * 2);
    ctx.fillStyle = "#111";
    ctx.fill();

    ctx.restore();
  });
}

// Loaded lazily and cached — only guests who pick the potato hat pay for it.
let potatoImg: HTMLImageElement | null = null;
let potatoImgLoading = false;
function ensurePotatoImg() {
  if (potatoImg || potatoImgLoading || typeof window === "undefined") return;
  potatoImgLoading = true;
  const img = new Image();
  img.onload = () => {
    potatoImg = img;
  };
  img.onerror = () => {
    potatoImgLoading = false;
  };
  img.src = "/art/potatoes.png";
}

/**
 * The same cached potato art the hat lens uses (`/art/potatoes.png` — the
 * project's own mascot, not the licensed iStock sprite). Exported so the
 * catch-game overlay can draw falling potatoes without a second image load.
 * Triggers the lazy load as a side effect; returns `null` while it's in
 * flight or hasn't been requested yet.
 */
export function getPotatoImage(): HTMLImageElement | null {
  ensurePotatoImg();
  return potatoImg;
}

function drawPotatoHat(ctx: CanvasRenderingContext2D, g: FaceGeometry) {
  ensurePotatoImg();
  if (!potatoImg) return; // still loading — skip this frame, try again next one
  const w = g.faceWidth * 1.15;
  const h = w * (potatoImg.naturalHeight / potatoImg.naturalWidth || 1);

  ctx.save();
  ctx.translate(g.forehead.x, g.forehead.y - h * 0.42);
  ctx.rotate(g.roll);
  ctx.drawImage(potatoImg, -w / 2, -h / 2, w, h);
  ctx.restore();
}

/**
 * Draw one face lens onto `ctx`. `width`/`height` must be the canvas's own
 * pixel dimensions — landmarks are normalized [0,1] and are scaled by these.
 */
/* --- Shared drawing helpers ------------------------------------------------
   Every prop below is anchored the same way: move the origin to a point on the
   face and rotate by the head's roll, so a tilted head wears the prop tilted.
   Working in that rotated space means each prop can be drawn as if the face
   were upright. */

function onFace(
  ctx: CanvasRenderingContext2D,
  at: Point,
  roll: number,
  draw: () => void,
) {
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(roll);
  draw();
  ctx.restore();
}

/** A heart, centred on the origin, `s` across. */
function heartPath(ctx: CanvasRenderingContext2D, s: number) {
  const w = s / 2;
  ctx.beginPath();
  ctx.moveTo(0, w * 0.75);
  ctx.bezierCurveTo(-w * 1.3, -w * 0.35, -w * 0.45, -w * 1.25, 0, -w * 0.4);
  ctx.bezierCurveTo(w * 0.45, -w * 1.25, w * 1.3, -w * 0.35, 0, w * 0.75);
  ctx.closePath();
}

/** An `n`-pointed star, centred on the origin. */
function starPath(ctx: CanvasRenderingContext2D, r: number, n = 5) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const rad = i % 2 === 0 ? r : r * 0.44;
    const a = (Math.PI * i) / n - Math.PI / 2;
    const fn = i === 0 ? "moveTo" : "lineTo";
    ctx[fn](Math.cos(a) * rad, Math.sin(a) * rad);
  }
  ctx.closePath();
}

/** A pointed animal ear, base-centred on the origin, opening upwards. */
function earPath(ctx: CanvasRenderingContext2D, w: number, h: number, lean: number) {
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0);
  ctx.quadraticCurveTo(lean * w * 0.5, -h, w / 2, 0);
  ctx.closePath();
}

function outlined(
  ctx: CanvasRenderingContext2D,
  fill: string | CanvasGradient,
  lineWidth: number,
) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = "#231815";
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = "round";
  ctx.stroke();
}

/* --- The props ------------------------------------------------------------ */

function drawDog(ctx: CanvasRenderingContext2D, g: FaceGeometry) {
  const u = g.eyeDist;
  // Floppy ears, hung off the sides of the head.
  for (const side of [-1, 1]) {
    onFace(ctx, g.eyeMid, g.roll, () => {
      ctx.translate(side * u * 0.95, -u * 0.35);
      ctx.rotate(side * 0.35);
      ctx.beginPath();
      ctx.ellipse(0, u * 0.55, u * 0.34, u * 0.72, 0, 0, Math.PI * 2);
      outlined(ctx, "#8b5a2b", u * 0.07);
      ctx.beginPath();
      ctx.ellipse(0, u * 0.6, u * 0.17, u * 0.45, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#c58a52";
      ctx.fill();
    });
  }
  // Snout.
  onFace(ctx, g.nose, g.roll, () => {
    ctx.beginPath();
    ctx.ellipse(0, 0, u * 0.3, u * 0.22, 0, 0, Math.PI * 2);
    outlined(ctx, "#3b2b22", u * 0.05);
    ctx.beginPath();
    ctx.ellipse(-u * 0.09, -u * 0.06, u * 0.07, u * 0.05, -0.4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fill();
  });
  // Tongue, out of the mouth.
  onFace(ctx, g.mouthMid, g.roll, () => {
    ctx.beginPath();
    ctx.moveTo(-u * 0.2, 0);
    ctx.quadraticCurveTo(0, u * 0.75, u * 0.2, 0);
    ctx.closePath();
    outlined(ctx, "#f2748b", u * 0.05);
    ctx.beginPath();
    ctx.moveTo(0, u * 0.08);
    ctx.lineTo(0, u * 0.42);
    ctx.strokeStyle = "#d4536c";
    ctx.lineWidth = u * 0.04;
    ctx.stroke();
  });
}

function drawCat(ctx: CanvasRenderingContext2D, g: FaceGeometry) {
  const u = g.eyeDist;
  for (const side of [-1, 1]) {
    onFace(ctx, g.forehead, g.roll, () => {
      ctx.translate(side * u * 0.56, u * 0.3);
      earPath(ctx, u * 0.62, u * 0.8, side * 0.25);
      outlined(ctx, "#4a4a4a", u * 0.07);
      ctx.save();
      ctx.scale(0.55, 0.6);
      earPath(ctx, u * 0.62, u * 0.8, side * 0.25);
      ctx.fillStyle = "#f0a9b8";
      ctx.fill();
      ctx.restore();
    });
  }
  onFace(ctx, g.nose, g.roll, () => {
    ctx.beginPath();
    ctx.moveTo(-u * 0.13, -u * 0.05);
    ctx.lineTo(u * 0.13, -u * 0.05);
    ctx.lineTo(0, u * 0.12);
    ctx.closePath();
    outlined(ctx, "#f0a9b8", u * 0.04);
    // Whiskers.
    ctx.strokeStyle = "#f8f8f8";
    ctx.lineWidth = u * 0.035;
    ctx.lineCap = "round";
    for (const side of [-1, 1]) {
      for (const [dy, spread] of [
        [-0.1, 0.06],
        [0.02, 0],
        [0.14, -0.06],
      ] as const) {
        ctx.beginPath();
        ctx.moveTo(side * u * 0.22, u * dy);
        ctx.lineTo(side * u * 0.95, u * (dy + spread));
        ctx.stroke();
      }
    }
  });
}

function drawBunny(ctx: CanvasRenderingContext2D, g: FaceGeometry) {
  const u = g.eyeDist;
  for (const side of [-1, 1]) {
    onFace(ctx, g.forehead, g.roll, () => {
      ctx.translate(side * u * 0.42, u * 0.05);
      ctx.rotate(side * 0.18);
      ctx.beginPath();
      ctx.ellipse(0, -u * 0.75, u * 0.25, u * 0.85, 0, 0, Math.PI * 2);
      outlined(ctx, "#fdfdfd", u * 0.07);
      ctx.beginPath();
      ctx.ellipse(0, -u * 0.75, u * 0.12, u * 0.6, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#f7c5d0";
      ctx.fill();
    });
  }
  onFace(ctx, g.nose, g.roll, () => {
    ctx.beginPath();
    ctx.ellipse(0, 0, u * 0.13, u * 0.1, 0, 0, Math.PI * 2);
    outlined(ctx, "#f7a8bb", u * 0.04);
  });
  // Two front teeth.
  onFace(ctx, g.mouthMid, g.roll, () => {
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.roundRect?.(side * u * 0.015 - (side < 0 ? u * 0.13 : 0), 0, u * 0.13, u * 0.22, u * 0.03);
      if (!ctx.roundRect) ctx.rect(side * u * 0.015 - (side < 0 ? u * 0.13 : 0), 0, u * 0.13, u * 0.22);
      outlined(ctx, "#ffffff", u * 0.03);
    }
  });
}

function drawCrown(ctx: CanvasRenderingContext2D, g: FaceGeometry) {
  const u = g.eyeDist;
  onFace(ctx, g.forehead, g.roll, () => {
    const w = u * 1.7;
    const h = u * 0.72;
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0);
    ctx.lineTo(-w / 2, -h * 0.45);
    ctx.lineTo(-w * 0.25, -h * 0.05);
    ctx.lineTo(0, -h);
    ctx.lineTo(w * 0.25, -h * 0.05);
    ctx.lineTo(w / 2, -h * 0.45);
    ctx.lineTo(w / 2, 0);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, -h, 0, 0);
    grad.addColorStop(0, "#ffe27a");
    grad.addColorStop(1, "#e0a92b");
    outlined(ctx, grad, u * 0.07);
    for (const [x, y] of [
      [-w * 0.25, -h * 0.05],
      [0, -h * 0.95],
      [w * 0.25, -h * 0.05],
    ] as const) {
      ctx.beginPath();
      ctx.arc(x, y, u * 0.09, 0, Math.PI * 2);
      outlined(ctx, "#e0475f", u * 0.035);
    }
  });
}

function drawHalo(ctx: CanvasRenderingContext2D, g: FaceGeometry, nowMs: number) {
  const u = g.eyeDist;
  const bob = Math.sin(nowMs / 420) * u * 0.06;
  onFace(ctx, g.forehead, g.roll, () => {
    ctx.translate(0, -u * 0.45 + bob);
    ctx.save();
    ctx.scale(1, 0.34);
    ctx.beginPath();
    ctx.arc(0, 0, u * 0.85, 0, Math.PI * 2);
    ctx.strokeStyle = "#ffd75e";
    ctx.lineWidth = u * 0.16;
    ctx.shadowColor = "rgba(255,220,110,0.95)";
    ctx.shadowBlur = u * 0.5;
    ctx.stroke();
    ctx.restore();
  });
}

function drawDevil(ctx: CanvasRenderingContext2D, g: FaceGeometry) {
  const u = g.eyeDist;
  for (const side of [-1, 1]) {
    onFace(ctx, g.forehead, g.roll, () => {
      ctx.translate(side * u * 0.6, u * 0.24);
      ctx.beginPath();
      ctx.moveTo(-u * 0.16, 0);
      ctx.quadraticCurveTo(side * u * 0.1, -u * 0.5, side * u * 0.34, -u * 0.72);
      ctx.quadraticCurveTo(side * u * 0.02, -u * 0.42, u * 0.16, 0);
      ctx.closePath();
      outlined(ctx, "#c0392b", u * 0.06);
    });
  }
}

function drawHeartEyes(ctx: CanvasRenderingContext2D, g: FaceGeometry, nowMs: number) {
  const u = g.eyeDist;
  const pulse = 1 + Math.sin(nowMs / 220) * 0.08;
  for (const eye of [g.eyeCenterA, g.eyeCenterB]) {
    onFace(ctx, eye, g.roll, () => {
      ctx.scale(pulse, pulse);
      heartPath(ctx, u * 0.62);
      outlined(ctx, "#e8365d", u * 0.05);
      ctx.save();
      ctx.translate(-u * 0.1, -u * 0.12);
      ctx.rotate(-0.5);
      ctx.beginPath();
      ctx.ellipse(0, 0, u * 0.07, u * 0.04, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.fill();
      ctx.restore();
    });
  }
}

function drawStarEyes(ctx: CanvasRenderingContext2D, g: FaceGeometry, nowMs: number) {
  const u = g.eyeDist;
  const spin = nowMs / 900;
  for (const eye of [g.eyeCenterA, g.eyeCenterB]) {
    onFace(ctx, eye, g.roll, () => {
      ctx.rotate(spin);
      starPath(ctx, u * 0.34);
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, u * 0.34);
      grad.addColorStop(0, "#fff6c9");
      grad.addColorStop(1, "#ffc233");
      outlined(ctx, grad, u * 0.05);
    });
  }
}

function drawShades(ctx: CanvasRenderingContext2D, g: FaceGeometry) {
  const u = g.eyeDist;
  onFace(ctx, g.eyeMid, g.roll, () => {
    const lensW = u * 0.72;
    const lensH = u * 0.5;
    ctx.fillStyle = "#141414";
    for (const side of [-1, 1]) {
      ctx.beginPath();
      const x = side * u * 0.52 - lensW / 2;
      if (ctx.roundRect) ctx.roundRect(x, -lensH / 2, lensW, lensH, u * 0.1);
      else ctx.rect(x, -lensH / 2, lensW, lensH);
      ctx.fill();
    }
    // Bridge and arms.
    ctx.strokeStyle = "#141414";
    ctx.lineWidth = u * 0.11;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-u * 0.16, -lensH * 0.18);
    ctx.lineTo(u * 0.16, -lensH * 0.18);
    ctx.moveTo(-u * 0.88, -lensH * 0.22);
    ctx.lineTo(-u * 1.12, -lensH * 0.05);
    ctx.moveTo(u * 0.88, -lensH * 0.22);
    ctx.lineTo(u * 1.12, -lensH * 0.05);
    ctx.stroke();
    // A glint across each lens.
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = u * 0.06;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * u * 0.52 - lensW * 0.32, lensH * 0.22);
      ctx.lineTo(side * u * 0.52 + lensW * 0.1, -lensH * 0.28);
      ctx.stroke();
    }
  });
}

function drawGentleman(ctx: CanvasRenderingContext2D, g: FaceGeometry) {
  const u = g.eyeDist;
  // Top hat.
  onFace(ctx, g.forehead, g.roll, () => {
    ctx.fillStyle = "#1c1c22";
    ctx.strokeStyle = "#231815";
    ctx.lineWidth = u * 0.06;
    ctx.beginPath();
    ctx.ellipse(0, 0, u * 1.15, u * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(-u * 0.62, -u * 1.1, u * 1.24, u * 1.1);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#8b1e3f";
    ctx.fillRect(-u * 0.62, -u * 0.32, u * 1.24, u * 0.2);
  });
  // Monocle on one eye.
  onFace(ctx, g.eyeCenterB, g.roll, () => {
    ctx.beginPath();
    ctx.arc(0, 0, u * 0.36, 0, Math.PI * 2);
    ctx.strokeStyle = "#d9b45a";
    ctx.lineWidth = u * 0.09;
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(u * 0.2, u * 0.3);
    ctx.quadraticCurveTo(u * 0.5, u * 0.9, u * 0.28, u * 1.35);
    ctx.strokeStyle = "#d9b45a";
    ctx.lineWidth = u * 0.05;
    ctx.stroke();
  });
  // Curled mustache.
  onFace(ctx, g.upperLip, g.roll, () => {
    ctx.strokeStyle = "#2b1d16";
    ctx.lineWidth = u * 0.13;
    ctx.lineCap = "round";
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(side * u * 0.3, u * 0.12, side * u * 0.46, -u * 0.12);
      ctx.stroke();
    }
  });
}

function drawFlowerCrown(ctx: CanvasRenderingContext2D, g: FaceGeometry) {
  const u = g.eyeDist;
  const petals = ["#f7a8c4", "#fff1a8", "#c9e7a8", "#f7c8a8", "#d7c0f0"];
  onFace(ctx, g.forehead, g.roll, () => {
    for (let i = 0; i < 7; i++) {
      const t = i / 6 - 0.5;
      const x = t * u * 2.1;
      const y = Math.abs(t) * Math.abs(t) * u * 1.1 - u * 0.12;
      const r = u * (i % 2 ? 0.15 : 0.2);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t * 1.2);
      for (let p = 0; p < 5; p++) {
        ctx.save();
        ctx.rotate((Math.PI * 2 * p) / 5);
        ctx.beginPath();
        ctx.ellipse(0, -r, r * 0.62, r, 0, 0, Math.PI * 2);
        ctx.fillStyle = petals[i % petals.length];
        ctx.fill();
        ctx.restore();
      }
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2);
      ctx.fillStyle = "#ffd75e";
      ctx.fill();
      ctx.restore();
    }
  });
}

function drawButterflies(ctx: CanvasRenderingContext2D, g: FaceGeometry, nowMs: number) {
  const u = g.eyeDist;
  const colours = ["#ff9ec4", "#9ad0ff", "#ffd98a", "#c4a8ff"];
  onFace(ctx, g.eyeMid, g.roll, () => {
    for (let i = 0; i < 4; i++) {
      // Each one circles the head on its own orbit and phase.
      const t = nowMs / 1100 + (i * Math.PI) / 2;
      const x = Math.cos(t) * u * (1.35 + i * 0.1);
      const y = Math.sin(t * 1.3) * u * 0.55 - u * 0.75;
      const flap = 0.45 + Math.abs(Math.sin(nowMs / 90 + i)) * 0.55;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.sin(t) * 0.4);
      ctx.fillStyle = colours[i % colours.length];
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.scale(side * flap, 1);
        ctx.beginPath();
        ctx.ellipse(u * 0.13, -u * 0.05, u * 0.14, u * 0.1, -0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(u * 0.1, u * 0.07, u * 0.1, u * 0.07, 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.beginPath();
      ctx.ellipse(0, 0, u * 0.022, u * 0.1, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#3a2b3f";
      ctx.fill();
      ctx.restore();
    }
  });
}

function drawLaserEyes(ctx: CanvasRenderingContext2D, g: FaceGeometry, nowMs: number) {
  const u = g.eyeDist;
  const flicker = 0.75 + Math.sin(nowMs / 70) * 0.25;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const eye of [g.eyeCenterA, g.eyeCenterB]) {
    onFace(ctx, eye, g.roll, () => {
      const len = u * 2.6;
      const grad = ctx.createLinearGradient(0, 0, 0, len);
      grad.addColorStop(0, `rgba(255,240,220,${0.95 * flicker})`);
      grad.addColorStop(0.25, `rgba(255,120,60,${0.8 * flicker})`);
      grad.addColorStop(1, "rgba(255,40,0,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(-u * 0.11, 0);
      ctx.lineTo(u * 0.11, 0);
      ctx.lineTo(u * 0.3, len);
      ctx.lineTo(-u * 0.3, len);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, u * 0.2 * flicker, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,235,220,0.95)";
      ctx.fill();
    });
  }
  ctx.restore();
}

function drawSnorkel(ctx: CanvasRenderingContext2D, g: FaceGeometry) {
  const u = g.eyeDist;
  onFace(ctx, g.eyeMid, g.roll, () => {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-u * 0.85, -u * 0.4, u * 1.7, u * 0.8, u * 0.26);
    else ctx.rect(-u * 0.85, -u * 0.4, u * 1.7, u * 0.8);
    ctx.fillStyle = "rgba(150,220,255,0.35)";
    ctx.fill();
    ctx.strokeStyle = "#e04a4a";
    ctx.lineWidth = u * 0.12;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = u * 0.07;
    ctx.beginPath();
    ctx.moveTo(-u * 0.75, u * 0.18);
    ctx.lineTo(-u * 0.35, -u * 0.22);
    ctx.stroke();
    // The tube, up one side.
    ctx.strokeStyle = "#e04a4a";
    ctx.lineWidth = u * 0.14;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(u * 0.85, u * 0.05);
    ctx.quadraticCurveTo(u * 1.2, -u * 0.45, u * 1.1, -u * 1.15);
    ctx.stroke();
  });
}

function drawSparkles(ctx: CanvasRenderingContext2D, g: FaceGeometry, nowMs: number) {
  const u = g.eyeDist;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  onFace(ctx, g.eyeMid, g.roll, () => {
    for (let i = 0; i < 12; i++) {
      // Deterministic scatter, so they twinkle rather than jitter about.
      const a = (i / 12) * Math.PI * 2 + i * 1.7;
      const rad = u * (0.9 + ((i * 37) % 100) / 130);
      const tw = 0.35 + 0.65 * Math.abs(Math.sin(nowMs / 300 + i));
      ctx.save();
      ctx.translate(Math.cos(a) * rad * 1.3, Math.sin(a) * rad);
      ctx.rotate(nowMs / 1600 + i);
      ctx.scale(tw, tw);
      starPath(ctx, u * 0.13, 4);
      ctx.fillStyle = "rgba(255,240,180,0.95)";
      ctx.fill();
      ctx.restore();
    }
  });
  ctx.restore();
}

function drawClown(ctx: CanvasRenderingContext2D, g: FaceGeometry) {
  const u = g.eyeDist;
  onFace(ctx, g.nose, g.roll, () => {
    ctx.beginPath();
    ctx.arc(0, 0, u * 0.28, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(-u * 0.09, -u * 0.09, u * 0.02, 0, 0, u * 0.28);
    grad.addColorStop(0, "#ff8a8a");
    grad.addColorStop(1, "#d32020");
    outlined(ctx, grad, u * 0.05);
  });
  // Cheek circles.
  for (const side of [-1, 1]) {
    onFace(ctx, g.nose, g.roll, () => {
      ctx.beginPath();
      ctx.arc(side * u * 0.78, u * 0.05, u * 0.24, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(240,80,110,0.5)";
      ctx.fill();
    });
  }
  // Tufts of hair.
  for (const side of [-1, 1]) {
    onFace(ctx, g.forehead, g.roll, () => {
      ctx.translate(side * u * 0.86, u * 0.62);
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(side * i * u * 0.16, -i * u * 0.16, u * 0.26, 0, Math.PI * 2);
        ctx.fillStyle = "#ff7a3d";
        ctx.fill();
      }
    });
  }
}

export function drawFaceLens(
  ctx: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  lensId: string,
  width: number,
  height: number,
  nowMs: number,
): void {
  const g = geometry(landmarks, width, height);
  switch (lensId) {
    case "googly-eyes":
      return drawGooglyEyes(ctx, g, nowMs);
    case "potato-hat":
      return drawPotatoHat(ctx, g);
    case "dog":
      return drawDog(ctx, g);
    case "cat":
      return drawCat(ctx, g);
    case "bunny":
      return drawBunny(ctx, g);
    case "crown":
      return drawCrown(ctx, g);
    case "halo":
      return drawHalo(ctx, g, nowMs);
    case "devil":
      return drawDevil(ctx, g);
    case "heart-eyes":
      return drawHeartEyes(ctx, g, nowMs);
    case "star-eyes":
      return drawStarEyes(ctx, g, nowMs);
    case "shades":
      return drawShades(ctx, g);
    case "gentleman":
      return drawGentleman(ctx, g);
    case "flower-crown":
      return drawFlowerCrown(ctx, g);
    case "butterflies":
      return drawButterflies(ctx, g, nowMs);
    case "laser-eyes":
      return drawLaserEyes(ctx, g, nowMs);
    case "snorkel":
      return drawSnorkel(ctx, g);
    case "sparkles":
      return drawSparkles(ctx, g, nowMs);
    case "clown":
      return drawClown(ctx, g);
    default:
      return;
  }
}
