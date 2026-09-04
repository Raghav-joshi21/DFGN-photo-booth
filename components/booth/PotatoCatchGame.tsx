"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

import { startFaceAr, type FaceArHandle } from "@/lib/ar";

type Status = "booting" | "ready" | "playing" | "over";

interface Potato {
  id: number;
  x: number;
  y: number;
  vy: number;
  r: number;
  rotation: number;
  spin: number;
  kind: "good" | "bad";
  eaten?: boolean;
}

interface MouthState {
  x: number;
  y: number;
  open: boolean;
  catchRadius: number;
}

// Landmarks used to find the mouth and to normalize its size by face scale
// (the same standard MediaPipe face-mesh indices used in lib/ar/draw.ts).
const MOUTH_UPPER = 13;
const MOUTH_LOWER = 14;
const MOUTH_LEFT = 61;
const MOUTH_RIGHT = 291;
const EYE_A = 33;
const EYE_B = 263;

// gap-between-lips / eye-distance above this counts as "mouth open". Tuned
// loose on purpose: a kiosk guest won't hit a precise threshold, and normal
// talking shouldn't accidentally "eat" a potato.
const MOUTH_OPEN_RATIO = 0.16;

// --- Sprite loading + tinting -------------------------------------------
// One PNG (public/art/potato-sprite.png), tinted green/red once via a
// source-atop composite so the per-frame draw is just a drawImage. Cached at
// module scope — shared across mounts/replays of the game.
let potatoImg: HTMLImageElement | null = null;
let potatoImgLoading = false;
let goodSprite: HTMLCanvasElement | null = null;
let badSprite: HTMLCanvasElement | null = null;

function tintSprite(img: HTMLImageElement, rgba: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext("2d");
  if (ctx) {
    ctx.drawImage(img, 0, 0);
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = rgba;
    ctx.fillRect(0, 0, c.width, c.height);
  }
  return c;
}

function ensureSprites() {
  if (potatoImg || potatoImgLoading || typeof window === "undefined") return;
  potatoImgLoading = true;
  const img = new Image();
  img.onload = () => {
    potatoImg = img;
    goodSprite = tintSprite(img, "rgba(46,196,101,0.55)"); // green: safe to eat
    badSprite = tintSprite(img, "rgba(217,48,48,0.62)"); // red: eating this ends the game
  };
  img.onerror = () => {
    potatoImgLoading = false;
  };
  img.src = "/art/potato-sprite.png";
}

function computeMouth(lm: NormalizedLandmark[], w: number, h: number): MouthState {
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

function drawPotato(ctx: CanvasRenderingContext2D, p: Potato) {
  const sprite = p.kind === "good" ? goodSprite : badSprite;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rotation);
  if (sprite) {
    ctx.drawImage(sprite, -p.r, -p.r, p.r * 2, p.r * 2);
  } else {
    // Sprite still loading — a plain circle keeps the game playable meanwhile.
    ctx.beginPath();
    ctx.arc(0, 0, p.r, 0, Math.PI * 2);
    ctx.fillStyle = p.kind === "good" ? "#2ec465" : "#d93030";
    ctx.fill();
  }
  ctx.restore();
}

function drawMouthRing(ctx: CanvasRenderingContext2D, mouth: MouthState) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(mouth.x, mouth.y, mouth.catchRadius, 0, Math.PI * 2);
  ctx.strokeStyle = mouth.open ? "rgba(255,214,64,0.9)" : "rgba(255,255,255,0.35)";
  ctx.lineWidth = Math.max(2, mouth.catchRadius * 0.06);
  ctx.stroke();
  ctx.restore();
}

/**
 * "Catch the falling potatoes" — the AR mini-game that used to be a
 * placeholder on the booth's game screen. Face-tracked with the same
 * MediaPipe pipeline as SelfCamera's AR lenses (lib/ar) — the FaceLandmarker
 * singleton is shared, so if a guest already ran the camera it's already warm
 * here. Standalone otherwise: it owns its own webcam stream rather than
 * reusing SelfCamera's, since the two screens are never mounted at once (see
 * app/booth/page.tsx) and each needs the stream released when it isn't up.
 *
 * Green potatoes fall from the top; open your mouth under one to eat it and
 * score. Red potatoes are poison — eat one and it's game over. Everything is
 * one canvas, drawn mirrored (like a mirror, not like a photo) so reaching
 * for a potato with your mouth feels natural; the HUD is DOM, on top of it.
 */
export function PotatoCatchGame({ onExit }: { onExit: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [status, setStatus] = useState<Status>("booting");
  const [error, setError] = useState<string | null>(null);
  const [eaten, setEaten] = useState(0);

  const statusRef = useRef<Status>("booting");
  const eatenRef = useRef(0);
  const potatoesRef = useRef<Potato[]>([]);
  const nextIdRef = useRef(0);
  const spawnAccRef = useRef(0);
  const lastFrameRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Acquire the camera. Same StrictMode-safe pattern as SelfCamera: the
  // `cancelled` guard stops a second run's play() colliding with the first
  // run's in-flight teardown.
  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;

    (async () => {
      setError(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Camera access needs a secure context (https:// or localhost).");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        try {
          await video.play();
        } catch (err) {
          if ((err as Error)?.name !== "AbortError") throw err;
        }
      } catch (err) {
        if (cancelled || (err as Error)?.name === "AbortError") return;
        console.error("[booth] game camera error", err);
        setError("Couldn't start the camera. Check permissions and try again.");
      }
    })();

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const spawnPotato = useCallback((canvasWidth: number) => {
    const r = canvasWidth * (0.05 + Math.random() * 0.02);
    potatoesRef.current.push({
      id: nextIdRef.current++,
      x: r + Math.random() * (canvasWidth - r * 2),
      y: -r,
      vy: 0.16 + Math.random() * 0.07, // canvas px per ms
      r,
      rotation: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.004,
      kind: Math.random() < 0.72 ? "good" : "bad",
    });
  }, []);

  // Face AR + the game loop itself. Boots once the camera has a frame.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;

    const onLoaded = () => {
      startFaceAr().then((ar: FaceArHandle | null) => {
        if (cancelled) return;
        if (!ar) {
          setError("Face tracking isn't available on this device, so the game can't run.");
          return;
        }
        ensureSprites();
        statusRef.current = "ready";
        setStatus("ready");

        const loop = (now: number) => {
          if (cancelled) return;
          const canvas = canvasRef.current;
          const v = videoRef.current;
          if (!canvas || !v || v.readyState < 2) {
            rafRef.current = requestAnimationFrame(loop);
            return;
          }
          if (canvas.width !== v.videoWidth || canvas.height !== v.videoHeight) {
            canvas.width = v.videoWidth;
            canvas.height = v.videoHeight;
          }

          const dt = lastFrameRef.current ? now - lastFrameRef.current : 16;
          lastFrameRef.current = now;

          const landmarks = ar.detect(v, now);
          const mouth = landmarks ? computeMouth(landmarks, canvas.width, canvas.height) : null;
          const playing = statusRef.current === "playing";

          if (playing) {
            // Spawn rate ramps up a little as the score climbs.
            spawnAccRef.current += dt;
            const interval = 950 - Math.min(400, eatenRef.current * 25);
            if (spawnAccRef.current > interval) {
              spawnAccRef.current = 0;
              spawnPotato(canvas.width);
            }

            for (const p of potatoesRef.current) {
              p.y += p.vy * dt;
              p.rotation += p.spin * dt;
            }
            // Missed potatoes (good or bad) just fall away — only eating a
            // red one is punished.
            potatoesRef.current = potatoesRef.current.filter(
              (p) => p.y - p.r < canvas.height + 60,
            );

            if (mouth?.open) {
              for (const p of potatoesRef.current) {
                const d = Math.hypot(p.x - mouth.x, p.y - mouth.y);
                if (d < p.r + mouth.catchRadius) {
                  p.eaten = true;
                  if (p.kind === "good") {
                    eatenRef.current += 1;
                    setEaten(eatenRef.current);
                  } else {
                    statusRef.current = "over";
                    setStatus("over");
                  }
                }
              }
              potatoesRef.current = potatoesRef.current.filter((p) => !p.eaten);
            }
          }

          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            // Mirror the whole game world — video, potatoes, and the mouth
            // ring together — so reaching for a falling potato feels like
            // looking in a mirror instead of fighting a reversed image.
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
            for (const p of potatoesRef.current) drawPotato(ctx, p);
            if (mouth) drawMouthRing(ctx, mouth);
            ctx.restore();
          }

          rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
      });
    };

    if (video.readyState >= 2) onLoaded();
    else video.addEventListener("loadeddata", onLoaded, { once: true });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      video.removeEventListener("loadeddata", onLoaded);
    };
  }, [spawnPotato]);

  const start = () => {
    potatoesRef.current = [];
    spawnAccRef.current = 0;
    eatenRef.current = 0;
    setEaten(0);
    statusRef.current = "playing";
    setStatus("playing");
  };

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="relative mx-auto aspect-[16/9] w-full max-w-[calc((100vh-13rem)*16/9)] overflow-hidden rounded-[26px] border-[4px] border-ink bg-black shadow-[8px_8px_0_var(--color-ink)]">
        {/* Off-screen source frame — the canvas is what's shown. */}
        <video ref={videoRef} playsInline muted className="hidden" />
        <canvas ref={canvasRef} className="h-full w-full object-contain" />

        {status === "playing" || status === "over" ? (
          <div className="absolute left-3 top-3 rounded-full bg-black/55 px-3 py-1.5 font-display text-sm font-bold text-white backdrop-blur-sm">
            🥔 Eaten: {eaten}
          </div>
        ) : null}

        <button
          onClick={onExit}
          className="absolute right-3 top-3 rounded-full border-2 border-white/50 bg-black/55 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm transition-transform hover:scale-105"
        >
          Back
        </button>

        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80 p-6 text-center text-sm text-white">
            <p className="max-w-sm text-balance">{error}</p>
            <button
              onClick={onExit}
              className="rounded-full border-[3px] border-ink bg-cream-light px-5 py-2 font-display font-bold text-ink shadow-[3px_3px_0_var(--color-ink)]"
            >
              Back
            </button>
          </div>
        ) : null}

        {!error && status === "booting" ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-sm text-white">
            Getting the camera ready…
          </div>
        ) : null}

        {!error && status === "ready" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/60 p-6 text-center text-white">
            <h2 className="font-display text-2xl font-extrabold uppercase tracking-tight">
              Catch the potatoes
            </h2>
            <p className="max-w-xs text-balance text-sm text-white/80">
              Open your mouth under a green potato to eat it. One red potato
              and you&apos;re out!
            </p>
            <button
              onClick={start}
              className="rounded-full border-[3px] border-ink bg-brand-orange px-8 py-2.5 font-display font-bold text-white shadow-[3px_3px_0_var(--color-ink)] transition-transform hover:-translate-y-0.5"
            >
              Start
            </button>
          </div>
        ) : null}

        {status === "over" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/70 p-6 text-center text-white">
            <h2 className="font-display text-2xl font-extrabold uppercase tracking-tight">
              Game over!
            </h2>
            <p className="text-base">
              You ate <span className="font-bold text-brand-orange">{eaten}</span> potato
              {eaten === 1 ? "" : "es"}.
            </p>
            <div className="flex gap-3">
              <button
                onClick={start}
                className="rounded-full border-[3px] border-ink bg-brand-orange px-6 py-2.5 font-display font-bold text-white shadow-[3px_3px_0_var(--color-ink)] transition-transform hover:-translate-y-0.5"
              >
                Play again
              </button>
              <button
                onClick={onExit}
                className="rounded-full border-[3px] border-ink bg-cream-light px-6 py-2.5 font-display font-bold text-ink shadow-[3px_3px_0_var(--color-ink)] transition-transform hover:-translate-y-0.5"
              >
                Back
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
