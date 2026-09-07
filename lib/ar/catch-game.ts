/**
 * "Catch the falling potatoes" — logic for the mini-game mode built directly
 * into SelfCamera's own preview (no separate screen, no second camera
 * stream). Every potato is the same plain sprite — `/art/potatoes.png`, the
 * project's own mascot art, reused via `getPotatoImage()` so it isn't loaded
 * twice — and eating one just scores a point. There is no danger variant.
 *
 * Pure/stateless on purpose: these functions take the current state and
 * return the next one rather than owning any of it, so SelfCamera can drive
 * them from the same rAF loop and `NormalizedLandmark[]` it already has each
 * frame for the static face lenses — no extra face-detection call needed.
 */
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

import { getPotatoImage } from "./draw";

export interface FallingPotato {
  id: number;
  x: number;
  y: number;
  vy: number;
  r: number;
  rotation: number;
  spin: number;
  eaten?: boolean;
}

export interface MouthState {
  x: number;
  y: number;
  open: boolean;
  catchRadius: number;
}

// Standard MediaPipe face-mesh indices (same ones used in draw.ts).
const MOUTH_UPPER = 13;
const MOUTH_LOWER = 14;
const MOUTH_LEFT = 61;
const MOUTH_RIGHT = 291;
const EYE_A = 33;
const EYE_B = 263;

// gap-between-lips / eye-distance above this counts as "mouth open". Loose on
// purpose — a kiosk guest won't hit a precise threshold, and normal talking
// shouldn't accidentally "eat" a potato.
const MOUTH_OPEN_RATIO = 0.16;

export function computeMouth(lm: NormalizedLandmark[], w: number, h: number): MouthState {
  const upper = { x: lm[MOUTH_UPPER].x * w, y: lm[MOUTH_UPPER].y * h };
  const lower = { x: lm[MOUTH_LOWER].x * w, y: lm[MOUTH_LOWER].y * h };
  const cornerL = { x: lm[MOUTH_LEFT].x * w, y: lm[MOUTH_LEFT].y * h };
  const cornerR = { x: lm[MOUTH_RIGHT].x * w, y: lm[MOUTH_RIGHT].y * h };
  const eyeA = { x: lm[EYE_A].x * w, y: lm[EYE_A].y * h };
  const eyeB = { x: lm[EYE_B].x * w, y: lm[EYE_B].y * h };

  const eyeDist = Math.hypot(eyeB.x - eyeA.x, eyeB.y - eyeA.y);
  const gap = Math.hypot(lower.x - upper.x, lower.y - upper.y);

  return {
    x: (cornerL.x + cornerR.x) / 2,
    y: (upper.y + lower.y) / 2,
    open: eyeDist > 0 && gap / eyeDist > MOUTH_OPEN_RATIO,
    // Generous on purpose — this is a kiosk game, not an aim test.
    catchRadius: eyeDist * 0.85,
  };
}

let nextId = 0;

export function spawnPotato(potatoes: FallingPotato[], canvasWidth: number): void {
  const r = canvasWidth * (0.05 + Math.random() * 0.02);
  potatoes.push({
    id: nextId++,
    x: r + Math.random() * (canvasWidth - r * 2),
    y: -r,
    vy: 0.16 + Math.random() * 0.07, // canvas px per ms
    r,
    rotation: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.004,
  });
}

/**
 * Advance falling potatoes by `dt` ms, drop the ones that fell off the
 * bottom, and — when the mouth is open — eat any potato it reaches. Mutates
 * and returns the same array (filtered), plus how many were eaten this tick.
 */
export function stepPotatoes(
  potatoes: FallingPotato[],
  dt: number,
  canvasHeight: number,
  mouth: MouthState | null,
): { potatoes: FallingPotato[]; eaten: number } {
  for (const p of potatoes) {
    p.y += p.vy * dt;
    p.rotation += p.spin * dt;
  }

  let next = potatoes.filter((p) => p.y - p.r < canvasHeight + 60);
  let eaten = 0;

  if (mouth?.open) {
    for (const p of next) {
      const d = Math.hypot(p.x - mouth.x, p.y - mouth.y);
      if (d < p.r + mouth.catchRadius) {
        p.eaten = true;
        eaten++;
      }
    }
    next = next.filter((p) => !p.eaten);
  }

  return { potatoes: next, eaten };
}

export function drawFallingPotato(ctx: CanvasRenderingContext2D, p: FallingPotato): void {
  const img = getPotatoImage();
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rotation);
  if (img) {
    ctx.drawImage(img, -p.r, -p.r, p.r * 2, p.r * 2);
  } else {
    // Still loading — a plain circle keeps the game visible meanwhile.
    ctx.beginPath();
    ctx.arc(0, 0, p.r, 0, Math.PI * 2);
    ctx.fillStyle = "#d9a441";
    ctx.fill();
  }
  ctx.restore();
}

export function drawMouthRing(ctx: CanvasRenderingContext2D, mouth: MouthState): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(mouth.x, mouth.y, mouth.catchRadius, 0, Math.PI * 2);
  ctx.strokeStyle = mouth.open ? "rgba(255,214,64,0.9)" : "rgba(255,255,255,0.35)";
  ctx.lineWidth = Math.max(2, mouth.catchRadius * 0.06);
  ctx.stroke();
  ctx.restore();
}
