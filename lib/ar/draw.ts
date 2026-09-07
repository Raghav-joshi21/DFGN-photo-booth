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
    default:
      return;
  }
}
