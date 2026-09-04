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

/** `ctx.roundRect` isn't in every runtime yet — fall back to a square corner. */
function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

function drawShades(ctx: CanvasRenderingContext2D, g: FaceGeometry) {
  const lensW = g.eyeDist * 0.62;
  const lensH = lensW * 0.72;
  const half = g.eyeDist / 2;

  ctx.save();
  ctx.translate(g.eyeMid.x, g.eyeMid.y);
  ctx.rotate(g.roll);

  ctx.fillStyle = "rgba(15,15,20,0.92)";
  ctx.strokeStyle = "rgba(0,0,0,0.9)";
  ctx.lineWidth = Math.max(2, lensH * 0.08);

  for (const side of [-1, 1] as const) {
    const cx = side * half;
    roundedRectPath(ctx, cx - lensW / 2, -lensH / 2, lensW, lensH, lensH * 0.35);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx - lensW * 0.18, -lensH * 0.18, lensW * 0.16, lensH * 0.12, -0.5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fill();
    ctx.fillStyle = "rgba(15,15,20,0.92)";
  }

  // Bridge and temples.
  ctx.beginPath();
  ctx.moveTo(-lensW * 0.18, 0);
  ctx.lineTo(lensW * 0.18, 0);
  ctx.moveTo(-half - lensW / 2, 0);
  ctx.lineTo(-half - lensW * 0.85, -lensH * 0.12);
  ctx.moveTo(half + lensW / 2, 0);
  ctx.lineTo(half + lensW * 0.85, -lensH * 0.12);
  ctx.stroke();

  ctx.restore();
}

function drawMustache(ctx: CanvasRenderingContext2D, g: FaceGeometry) {
  const w = g.mouthWidth * 1.3;
  const h = w * 0.28;

  ctx.save();
  ctx.translate(g.upperLip.x, g.upperLip.y - h * 0.25);
  ctx.rotate(g.roll);
  ctx.fillStyle = "#2b1c14";

  // Centre bar plus a curled lobe per side — built from overlapping ellipses
  // rather than a hand-fit bezier, so it can't render as a broken self-cross.
  ctx.beginPath();
  ctx.ellipse(0, 0, w * 0.32, h * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  for (const side of [-1, 1] as const) {
    ctx.beginPath();
    ctx.ellipse(side * w * 0.34, -h * 0.05, w * 0.22, h * 0.55, side * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(side * w * 0.5, -h * 0.32, w * 0.09, h * 0.28, side * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawCrown(ctx: CanvasRenderingContext2D, g: FaceGeometry) {
  const w = g.faceWidth * 0.95;
  const h = w * 0.5;
  const baseY = h * 0.42;

  ctx.save();
  ctx.translate(g.forehead.x, g.forehead.y - h * 0.55);
  ctx.rotate(g.roll);

  ctx.beginPath();
  ctx.moveTo(-w / 2, baseY);
  ctx.lineTo(-w / 2, baseY - h * 0.15);
  ctx.lineTo(-w / 3, -h * 0.15);
  ctx.lineTo(-w / 6, baseY - h * 0.35);
  ctx.lineTo(0, -h * 0.5);
  ctx.lineTo(w / 6, baseY - h * 0.35);
  ctx.lineTo(w / 3, -h * 0.15);
  ctx.lineTo(w / 2, baseY - h * 0.15);
  ctx.lineTo(w / 2, baseY);
  ctx.closePath();

  const grad = ctx.createLinearGradient(0, -h * 0.5, 0, baseY);
  grad.addColorStop(0, "#ffe066");
  grad.addColorStop(1, "#d99a2b");
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, w * 0.012);
  ctx.strokeStyle = "#8a5a12";
  ctx.stroke();

  const gems: Array<[number, number, string]> = [
    [-w / 3, -h * 0.12, "#e0435c"],
    [0, -h * 0.42, "#3fa7ff"],
    [w / 3, -h * 0.12, "#4bd07a"],
  ];
  for (const [gx, gy, color] of gems) {
    ctx.beginPath();
    ctx.arc(gx, gy, w * 0.035, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  ctx.restore();
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
    case "shades":
      return drawShades(ctx, g);
    case "mustache":
      return drawMustache(ctx, g);
    case "crown":
      return drawCrown(ctx, g);
    case "googly-eyes":
      return drawGooglyEyes(ctx, g, nowMs);
    case "potato-hat":
      return drawPotatoHat(ctx, g);
    default:
      return;
  }
}
