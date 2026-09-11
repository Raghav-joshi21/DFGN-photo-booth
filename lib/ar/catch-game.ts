/**
 * "Catch the falling potatoes" — logic for the mini-game mode built directly
 * into SelfCamera's own preview (no separate screen, no second camera
 * stream). Every potato is the same plain sprite — `/art/potatoes.png`, the
 * project's own mascot art, reused via `getPotatoImage()` so it isn't loaded
 * twice — tinted per-variant on the canvas rather than loading extra art.
 * Most potatoes are plain (+1); a rare golden one is worth +3, and a rotten
 * one (tagged with 🤢) costs a point and breaks the guest's combo if eaten.
 *
 * SelfCamera runs this as a timed round (countdown → 30s → results), not an
 * open-ended toggle — see its own comments for that state machine. This
 * module stays purely about the falling-potato physics/scoring/juice.
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
  /** A rare golden potato is worth more and gets its own catch sound/particle colour. */
  golden?: boolean;
  /** A rotten one is the one to dodge — eating it costs a point and breaks the combo. */
  rotten?: boolean;
  /** Points this potato is worth when caught — 1 normally, more if golden, negative if rotten. */
  value: number;
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

/** One in this many potatoes is golden — worth more, and worth chasing. */
const GOLDEN_ODDS = 8;
/** One in this many (of the non-golden rest) is rotten — the one to dodge. */
const ROTTEN_ODDS = 5;

/**
 * `speedMul` ramps the game up as the guest's score climbs (see SelfCamera's
 * difficulty curve) — 1 at the start, capped well short of "unfair" so a
 * kiosk guest can always still catch something.
 */
export function spawnPotato(
  potatoes: FallingPotato[],
  canvasWidth: number,
  speedMul = 1,
): void {
  const golden = Math.random() < 1 / GOLDEN_ODDS;
  const rotten = !golden && Math.random() < 1 / ROTTEN_ODDS;
  const r = canvasWidth * (0.05 + Math.random() * 0.02) * (golden ? 0.85 : 1);
  potatoes.push({
    id: nextId++,
    x: r + Math.random() * (canvasWidth - r * 2),
    y: -r,
    vy: (0.16 + Math.random() * 0.07) * speedMul, // canvas px per ms
    r,
    rotation: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.004 * (golden ? 2.2 : 1),
    golden,
    rotten,
    value: golden ? 3 : rotten ? -1 : 1,
  });
}

/** One caught potato, at the moment it's eaten — enough to spawn a burst of
 *  particles and a score popup right where the catch happened. */
export interface CatchEvent {
  x: number;
  y: number;
  value: number;
  golden: boolean;
  rotten: boolean;
}

/**
 * Advance the potatoes and let any open mouth eat them.
 *
 * Takes every mouth in frame, not one: the booth tracks a group, so a whole
 * huddle can play at once. A potato is removed on the first mouth that catches
 * it, so two people lunging at the same one cannot both score it. Returns the
 * updated list plus one `CatchEvent` per potato eaten this tick, so the
 * caller can react at each catch's exact position (particles, a "+1" popup,
 * a sound) rather than just knowing a count.
 */
export function stepPotatoes(
  potatoes: FallingPotato[],
  dt: number,
  canvasHeight: number,
  mouths: MouthState[],
): { potatoes: FallingPotato[]; eaten: number; catches: CatchEvent[] } {
  for (const p of potatoes) {
    p.y += p.vy * dt;
    p.rotation += p.spin * dt;
  }

  let next = potatoes.filter((p) => p.y - p.r < canvasHeight + 60);
  const catches: CatchEvent[] = [];

  for (const mouth of mouths) {
    if (!mouth.open) continue;
    for (const p of next) {
      if (p.eaten) continue;
      const d = Math.hypot(p.x - mouth.x, p.y - mouth.y);
      if (d < p.r + mouth.catchRadius) {
        p.eaten = true;
        catches.push({ x: p.x, y: p.y, value: p.value, golden: !!p.golden, rotten: !!p.rotten });
      }
    }
  }
  if (catches.length > 0) next = next.filter((p) => !p.eaten);

  return { potatoes: next, eaten: catches.length, catches };
}

export function drawFallingPotato(ctx: CanvasRenderingContext2D, p: FallingPotato): void {
  const img = getPotatoImage();
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rotation);
  // Golden potatoes get a warm glow so they read as "special" even mid-fall,
  // not just once caught. Rotten ones are tinted sickly green — the one to
  // dodge, not eat — via a canvas filter so the same sprite doubles as both.
  if (p.golden) {
    ctx.shadowColor = "rgba(255,206,64,0.9)";
    ctx.shadowBlur = p.r * 0.9;
  } else if (p.rotten) {
    ctx.filter = "sepia(1) hue-rotate(70deg) saturate(3.5) brightness(0.75)";
  }
  if (img) {
    ctx.drawImage(img, -p.r, -p.r, p.r * 2, p.r * 2);
  } else {
    // Still loading — a plain circle keeps the game visible meanwhile.
    ctx.beginPath();
    ctx.arc(0, 0, p.r, 0, Math.PI * 2);
    ctx.fillStyle = p.golden ? "#f2c744" : p.rotten ? "#5c6b2e" : "#d9a441";
    ctx.fill();
  }
  ctx.restore();

  // A little warning glyph above rotten ones — the tint alone is subtle at
  // kiosk viewing distance, and this is the one potato a guest must avoid.
  if (p.rotten) {
    ctx.save();
    ctx.font = `${Math.round(p.r * 0.9)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("🤢", p.x, p.y - p.r * 1.15);
    ctx.restore();
  }
}

// --- Catch "juice": burst particles + a floating score popup --------------
// Purely cosmetic feedback layered on top of the same overlay canvas — short
// lived (a few hundred ms) so it never needs its own on/off state, just a
// step + draw pass alongside the potatoes each frame.

export interface CatchParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // ms remaining
  maxLife: number;
  color: string;
  size: number;
}

export interface ScorePopup {
  x: number;
  y: number;
  text: string;
  life: number; // ms remaining
  maxLife: number;
  color: string;
  /** A combo-bonus callout — noticeably bigger than a plain "+1". */
  big?: boolean;
}

const PARTICLE_COLORS = ["#d9a441", "#e8c27a", "#fff4dc"];
const GOLDEN_COLORS = ["#f2c744", "#ffe27a", "#ffffff"];
const ROTTEN_COLORS = ["#5c6b2e", "#7a8c3d", "#3c4620"];
const CONFETTI_COLORS = ["#ee8b2b", "#f2c744", "#7fa045", "#5a1618", "#ffffff"];

/** A little burst at a catch: crumbs normally, a bigger sparkle burst for
 *  gold, a dull downward splat for rotten. */
export function spawnCatchParticles(
  particles: CatchParticle[],
  x: number,
  y: number,
  kind: "normal" | "golden" | "rotten" = "normal",
): void {
  const count = kind === "golden" ? 14 : kind === "rotten" ? 10 : 8;
  const colors = kind === "golden" ? GOLDEN_COLORS : kind === "rotten" ? ROTTEN_COLORS : PARTICLE_COLORS;
  const speedBase = kind === "golden" ? 0.25 : kind === "rotten" ? 0.14 : 0.16;
  // Rotten crumbs splat downward (gravity already pulls them, so barely any
  // upward bias) instead of bursting outward like a "got it" would.
  const upwardBias = kind === "rotten" ? 0.01 : 0.05;
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const speed = speedBase + Math.random() * 0.12;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - upwardBias,
      life: 380 + Math.random() * 160,
      maxLife: 500,
      color: colors[i % colors.length],
      size: (kind === "golden" ? 3.5 : 2.5) + Math.random() * 2,
    });
  }
}

/** A bigger, brighter confetti burst for score milestones (10, 25, 50…). */
export function spawnMilestoneBurst(particles: CatchParticle[], x: number, y: number): void {
  for (let i = 0; i < 26; i++) {
    const angle = (Math.PI * 2 * i) / 26 + Math.random() * 0.3;
    const speed = 0.2 + Math.random() * 0.22;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 0.1,
      life: 550 + Math.random() * 250,
      maxLife: 800,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      size: 3 + Math.random() * 2.5,
    });
  }
}

export function stepParticles(particles: CatchParticle[], dt: number): CatchParticle[] {
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 0.0006 * dt; // gentle gravity
    p.life -= dt;
  }
  return particles.filter((p) => p.life > 0);
}

export function drawParticles(ctx: CanvasRenderingContext2D, particles: CatchParticle[]): void {
  for (const p of particles) {
    const t = Math.max(0, p.life / p.maxLife);
    ctx.save();
    ctx.globalAlpha = t;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * t, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.restore();
  }
}

/** "+1", "+3 GOLDEN!", or a combo callout — rises and fades over its life.
 *  `big` is for a combo-streak bonus: bigger, and it lingers longer. */
export function spawnScorePopup(
  popups: ScorePopup[],
  x: number,
  y: number,
  text: string,
  color = "#fff",
  big = false,
): void {
  const life = big ? 1000 : 700;
  popups.push({ x, y, text, life, maxLife: life, color, big });
}

export function stepPopups(popups: ScorePopup[], dt: number): ScorePopup[] {
  for (const p of popups) {
    p.y -= (p.big ? 0.03 : 0.045) * dt;
    p.life -= dt;
  }
  return popups.filter((p) => p.life > 0);
}

export function drawPopups(ctx: CanvasRenderingContext2D, popups: ScorePopup[]): void {
  for (const p of popups) {
    const t = Math.max(0, p.life / p.maxLife);
    // Big ones punch in with a quick overshoot-then-settle scale, rather
    // than just fading in place like a plain "+1" — that's most of what
    // reads as "big" beyond the larger font.
    const growIn = p.big ? Math.min(1, (1 - t) * 6) : 1;
    const scale = p.big ? 0.7 + 0.5 * Math.sin(Math.min(growIn, 1) * (Math.PI / 2)) : 1;
    ctx.save();
    ctx.globalAlpha = Math.min(1, t * 1.4);
    ctx.translate(p.x, p.y);
    ctx.scale(scale, scale);
    if (p.big) {
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 18;
    }
    ctx.font = p.big ? "bold 40px sans-serif" : "bold 22px sans-serif";
    ctx.textAlign = "center";
    ctx.lineWidth = p.big ? 5 : 3;
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.strokeText(p.text, 0, 0);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, 0, 0);
    ctx.restore();
  }
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

/**
 * A short "pop" when a potato is caught — pitches up with the guest's combo
 * streak so a run of quick catches actually sounds like it's building into
 * something, and swaps in a brighter two-note chime for a golden potato.
 *
 * Synthesised rather than loaded from a file: it is a fraction of a second of
 * tone, and a booth that already pulls a 6MB face model does not need another
 * asset for it. The context is created on first use, which is always inside a
 * tap (the game is switched on by one), so autoplay policy is happy.
 *
 * Best-effort throughout — a booth with no audio output should still play the
 * game, so every failure here is swallowed.
 */
let audio: AudioContext | null = null;

function tone(
  ctx: AudioContext,
  startAt: number,
  from: number,
  to: number,
  duration: number,
  peakGain: number,
  type: OscillatorType,
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, startAt);
  osc.frequency.exponentialRampToValueAtTime(to, startAt + duration * 0.45);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(peakGain, startAt + duration * 0.06);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + duration);
}

export function playCatchSound(opts: { combo?: number; golden?: boolean } = {}): void {
  const { combo = 1, golden = false } = opts;
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume();
    const t = audio.currentTime;

    if (golden) {
      // A little two-note chime — reads as a jackpot, not just another catch.
      tone(audio, t, 660, 990, 0.16, 0.24, "triangle");
      tone(audio, t + 0.08, 990, 1320, 0.18, 0.2, "sine");
      return;
    }

    // Combo climbs the pitch each consecutive catch (capped so it never
    // shrieks), which is most of what makes a streak feel like a streak.
    const step = Math.min(combo - 1, 6);
    const base = 480 + step * 55;
    tone(audio, t, base, base + 380, 0.2, 0.22, "triangle");
  } catch {
    // No audio output, or a context the browser refused to start.
  }
}

/** A low descending "yuck" for eating the rotten potato — unmistakably a
 *  penalty, not another catch. */
export function playRottenSound(): void {
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume();
    const t = audio.currentTime;
    tone(audio, t, 260, 120, 0.28, 0.2, "sawtooth");
  } catch {
    // No audio output, or a context the browser refused to start.
  }
}

/** A quick three-note rising fanfare for a score milestone (10, 25, 50…). */
export function playMilestoneSound(): void {
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume();
    const t = audio.currentTime;
    tone(audio, t, 520, 660, 0.14, 0.2, "triangle");
    tone(audio, t + 0.1, 660, 830, 0.14, 0.2, "triangle");
    tone(audio, t + 0.2, 830, 1100, 0.22, 0.22, "triangle");
  } catch {
    // No audio output, or a context the browser refused to start.
  }
}
