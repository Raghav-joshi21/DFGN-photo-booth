"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import type { Lens } from "@snap/camera-kit";

import {
  hasCameraKitEnv,
  startCameraKit,
  type CameraKitHandle,
} from "@/lib/camera-kit";
import { CSS_FILTERS } from "@/lib/camera-kit/css-filters";
import { FACE_LENSES, startFaceAr, type FaceArHandle } from "@/lib/ar";
import {
  computeMouth,
  drawFallingPotato,
  drawMouthRing,
  spawnPotato,
  stepPotatoes,
  type FallingPotato,
} from "@/lib/ar/catch-game";
import { drawFaceLens } from "@/lib/ar/draw";
import { savePhoto } from "@/lib/photos/save";

type Phase = "preview" | "counting" | "captured";

/**
 * Self-camera capture screen for the booth.
 *
 * Live webcam preview → 3-2-1 countdown → capture a frame to a canvas → show
 * the result. This is a placeholder: capturing works for real, but "Use this
 * photo" is stubbed (that's where the Polaroid-eject animation + upload of a
 * source:'booth' photo will go — see TODO below).
 *
 * getUserMedia needs a secure context, so this only works over https:// or
 * localhost. Run `pnpm dev:lan` (HTTPS) when testing from the LAN.
 *
 * `onExit` is optional: mounted inline on the booth's idle screen there is
 * nowhere to go back to, so the Back button is simply omitted and finishing a
 * capture returns to the live preview instead.
 */
export function SelfCamera({ onExit }: { onExit?: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [phase, setPhase] = useState<Phase>("preview");
  const [count, setCount] = useState(3);
  const [captured, setCaptured] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Bumping this re-runs the acquire effect (the "Try again" button).
  const [attempt, setAttempt] = useState(0);

  // --- Snap Camera Kit (optional live filters) ---------------------------
  // `lens === null` is the always-available "no filter" option. The potato
  // lens is applied on start-up when the group ships one, so a guest who
  // ignores the strip still gets the house look.
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const kitRef = useRef<CameraKitHandle | null>(null);
  const [lenses, setLenses] = useState<Lens[]>([]);
  const [activeLensId, setActiveLensId] = useState<string | null>(null);
  const [kitReady, setKitReady] = useState(false);

  // Built-in colour tint, applied on top of whatever lens is active (and on
  // its own when Camera Kit is off). `null` is "no tint". See css-filters.ts.
  const [tintId, setTintId] = useState<string | null>(null);
  const tint = CSS_FILTERS.find((f) => f.id === tintId) ?? null;
  // Set once the stream exists, so the Camera Kit effect can wait for it.
  const [streamReady, setStreamReady] = useState(false);

  // --- Face-tracked AR lenses (ours, no Snap account) ---------------------
  // Runs off the raw <video> regardless of Camera Kit, drawing onto its own
  // transparent overlay canvas painted on top of whichever preview is showing.
  // See lib/ar. `arReady` gates whether the AR chips even appear.
  const arCanvasRef = useRef<HTMLCanvasElement>(null);
  const [arReady, setArReady] = useState(false);
  const [faceLensId, setFaceLensId] = useState<string | null>(null);
  // The rAF loop below reads the selection through a ref so picking a new
  // lens doesn't need to tear down and restart the detection loop.
  const faceLensIdRef = useRef<string | null>(null);
  useEffect(() => {
    faceLensIdRef.current = faceLensId;
  }, [faceLensId]);

  // --- "Catch the falling potatoes" mode ----------------------------------
  // Runs right inside this same preview and the same detection loop below —
  // no separate screen, no second camera stream. Plain potatoes only (no
  // colour variants): open your mouth under one to eat it and score.
  const [gameOn, setGameOn] = useState(false);
  const [eaten, setEaten] = useState(0);
  const gameOnRef = useRef(false);
  const eatenRef = useRef(0);
  const potatoesRef = useRef<FallingPotato[]>([]);
  const spawnAccRef = useRef(0);
  const lastFrameRef = useRef(0);
  useEffect(() => {
    gameOnRef.current = gameOn;
    if (!gameOn) potatoesRef.current = []; // clear the board when switched off
  }, [gameOn]);
  // The loop only steps/spawns while the guest can actually see it.
  const phaseRef = useRef<Phase>("preview");
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Acquire the camera on mount, release it on unmount.
  //
  // Written defensively because React StrictMode mounts effects twice in dev:
  // the first run's cleanup stops the tracks while its getUserMedia/play() is
  // still in flight, so the second run reassigns srcObject underneath the
  // pending play() and the browser rejects it with AbortError. Without the
  // `cancelled` guard that lands in the catch below and renders as a bogus
  // "couldn't access the camera" — even though permission was granted.
  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;

    const start = async () => {
      setError(null);

      // Absent entirely (rather than throwing) when the page isn't a secure
      // context — worth its own message, since the fix is a different URL.
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(
          "This browser won't expose the camera here. Camera access needs a secure context — open the site over https:// (run `pnpm dev:lan`), not http://.",
        );
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });

        // Unmounted (or re-run) while we were awaiting: release immediately,
        // otherwise the camera light stays on with no one holding the stream.
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          stream = null;
          return;
        }

        streamRef.current = stream;
        setStreamReady(true);
        const video = videoRef.current;
        if (!video) return;

        video.srcObject = stream;
        try {
          await video.play();
        } catch (err) {
          // play() rejects with AbortError when the element is torn down or its
          // source swapped mid-play. Harmless — the next run starts playback.
          if ((err as Error)?.name !== "AbortError") throw err;
        }
      } catch (err) {
        if (cancelled || (err as Error)?.name === "AbortError") return;

        console.error("[booth] camera error", err);
        const name = (err as Error)?.name;
        if (name === "NotAllowedError" || name === "SecurityError") {
          setError(
            "Camera permission was blocked. Allow camera access for this site in your browser settings, then tap Try again.",
          );
        } else if (name === "NotFoundError" || name === "OverconstrainedError") {
          setError("No camera found on this device.");
        } else if (name === "NotReadableError") {
          setError("The camera is already in use by another app. Close it and tap Try again.");
        } else {
          setError(
            "Couldn't start the camera. Make sure you're on https:// (run `pnpm dev:lan`) and tap Try again.",
          );
        }
      }
    };

    start();

    return () => {
      cancelled = true;
      setStreamReady(false);
      stream?.getTracks().forEach((t) => t.stop());
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [attempt]);

  // Bring up Camera Kit on top of the live stream. Entirely optional: if it
  // never becomes ready the plain <video> preview stays on screen and the rest
  // of the flow is untouched.
  useEffect(() => {
    if (!streamReady || !hasCameraKitEnv()) return;
    const stream = streamRef.current;
    const canvas = canvasRef.current;
    if (!stream || !canvas) return;

    let cancelled = false;
    let handle: CameraKitHandle | null = null;

    startCameraKit(stream, canvas).then((result) => {
      if (!result) return;
      if (cancelled) {
        result.destroy();
        return;
      }
      handle = result;
      kitRef.current = result;
      setLenses(result.lenses);
      setKitReady(true);

      // Start on the potato lens. Best-effort like the rest of this layer: a
      // lens that won't download leaves the plain (unfiltered) session up.
      if (result.defaultLens) {
        setActiveLensId(result.defaultLens.id);
        result.session.applyLens(result.defaultLens).catch((err) => {
          console.warn("[booth] could not apply the default lens", err);
          setActiveLensId(null);
        });
      }
    });

    return () => {
      cancelled = true;
      handle?.destroy();
      kitRef.current = null;
      setKitReady(false);
      setLenses([]);
      setActiveLensId(null);
    };
  }, [streamReady, attempt]);

  // Face-tracked AR: independent of Camera Kit, runs off the raw <video> and
  // paints onto its own overlay canvas every animation frame. Also entirely
  // optional — if the model can't load, `startFaceAr` resolves null and the
  // AR chips just never appear.
  useEffect(() => {
    if (!streamReady) return;

    let cancelled = false;
    let rafId = 0;

    startFaceAr().then((ar: FaceArHandle | null) => {
      if (cancelled || !ar) return;
      setArReady(true);
      // House style: the potato hat leads, same as the potato Snap lens
      // above. Only sets it the first time — doesn't clobber a guest's own
      // pick across a "Try again" re-run.
      setFaceLensId((cur) => cur ?? "potato-hat");

      const loop = () => {
        if (cancelled) return;
        const video = videoRef.current;
        const canvas = arCanvasRef.current;
        if (video && canvas && video.readyState >= 2) {
          if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
          }
          const ctx = canvas.getContext("2d");
          const now = performance.now();
          const dt = lastFrameRef.current ? now - lastFrameRef.current : 16;
          lastFrameRef.current = now;
          const landmarks = ar.detect(video, now);
          const mouth =
            gameOnRef.current && landmarks
              ? computeMouth(landmarks, canvas.width, canvas.height)
              : null;

          // Catch-game step: reuses the same landmarks already detected above
          // for the face lens — no extra detection call needed.
          if (gameOnRef.current && phaseRef.current !== "captured") {
            spawnAccRef.current += dt;
            if (spawnAccRef.current > 900) {
              spawnAccRef.current = 0;
              spawnPotato(potatoesRef.current, canvas.width);
            }
            const result = stepPotatoes(potatoesRef.current, dt, canvas.height, mouth);
            potatoesRef.current = result.potatoes;
            if (result.eaten > 0) {
              eatenRef.current += result.eaten;
              setEaten(eatenRef.current);
            }
          }

          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const lensId = faceLensIdRef.current;
            if (landmarks && lensId) {
              drawFaceLens(ctx, landmarks, lensId, canvas.width, canvas.height, now);
            }
            if (gameOnRef.current) {
              for (const p of potatoesRef.current) drawFallingPotato(ctx, p);
              if (mouth) drawMouthRing(ctx, mouth);
            }
          }
        }
        rafId = requestAnimationFrame(loop);
      };
      rafId = requestAnimationFrame(loop);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      setArReady(false);
    };
  }, [streamReady, attempt]);

  /** Swap the live lens. `null` removes it (the "no filter" option). */
  const selectLens = useCallback(async (lens: Lens | null) => {
    const kit = kitRef.current;
    if (!kit) return;
    // Optimistic: the strip should respond immediately, not after the lens
    // finishes downloading.
    setActiveLensId(lens?.id ?? null);
    try {
      if (lens) await kit.session.applyLens(lens);
      else await kit.session.removeLens();
    } catch (err) {
      console.warn("[booth] could not apply lens", err);
      setActiveLensId(null);
    }
  }, []);

  // Countdown driver.
  useEffect(() => {
    if (phase !== "counting") return;
    if (count <= 0) {
      capture();
      return;
    }
    const t = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, count]);

  const capture = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    // With a lens applied the raw webcam frame no longer matches what the guest
    // sees, so the snapshot has to come from Camera Kit's rendered canvas.
    const kitCanvas = kitReady ? canvasRef.current : null;
    const source: HTMLVideoElement | HTMLCanvasElement = kitCanvas ?? video;
    const srcW = kitCanvas ? kitCanvas.width : video.videoWidth;
    const srcH = kitCanvas ? kitCanvas.height : video.videoHeight;

    const size = Math.min(srcW, srcH) || 720;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Bake the colour tint into the pixels: a CSS filter on the preview element
    // does not travel through drawImage, so it has to be re-applied here.
    if (tint) ctx.filter = tint.css;
    // Center-crop to a square. Not mirrored: the print should match what the
    // guest saw on screen, and a mirrored frame reverses any lens text with it.
    const sx = (srcW - size) / 2;
    const sy = (srcH - size) / 2;
    ctx.drawImage(source, sx, sy, size, size, 0, 0, size, size);
    // Face-tracked AR props live on their own canvas (see arCanvasRef), sized
    // to the same video frame — composite it in with the same crop and tint
    // so the print matches what the guest saw.
    const arCanvas = arCanvasRef.current;
    if ((faceLensId || gameOn) && arCanvas && arCanvas.width > 0) {
      ctx.drawImage(arCanvas, sx, sy, size, size, 0, 0, size, size);
    }
    setCaptured(canvas.toDataURL("image/jpeg", 0.92));
    setPhase("captured");
  }, [kitReady, tint, faceLensId, gameOn]);

  const startCountdown = () => {
    setCount(3);
    setPhase("counting");
  };

  const retake = () => {
    setCaptured(null);
    setPhase("preview");
  };

  /**
   * "Start over" on the review screen: drop the shot and go back to the live
   * preview without saving, and reset the filters to the booth's defaults so
   * the next guest starts clean.
   */
  const startOver = () => {
    retake();
    setTintId(null);
    // Back to the house default, same as the Snap lens below — not "off".
    setFaceLensId(arReady ? "potato-hat" : null);
    const kit = kitRef.current;
    if (kit) {
      const fallback = kit.defaultLens;
      setActiveLensId(fallback?.id ?? null);
      (fallback ? kit.session.applyLens(fallback) : kit.session.removeLens()).catch(
        () => setActiveLensId(null),
      );
    }
  };

  const usePhoto = async () => {
    if (captured && !saving) {
      setSaving(true);
      try {
        // data: URL -> Blob, so savePhoto can send the smaller binary to
        // Storage on the Supabase path and the data URL to the local store.
        const blob = await (await fetch(captured)).blob();
        await savePhoto({ blob, dataUrl: captured, source: "booth" });
      } catch (err) {
        // Non-fatal: the booth should never get stuck on a failed save.
        console.error("[booth] could not send capture to the wall", err);
      } finally {
        setSaving(false);
      }
    }
    if (onExit) onExit();
    else retake(); // Inline: hand the booth straight back to a live preview.
  };

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="relative mx-auto aspect-[16/9] w-full max-w-[calc((100vh-13rem)*16/9)] overflow-hidden rounded-[26px] border-[4px] border-ink bg-black shadow-[8px_8px_0_var(--color-ink)]">
        {/* Live preview (hidden once we have a capture). */}
        <video
          ref={videoRef}
          playsInline
          muted
          className="h-full w-full object-contain"
          style={{ filter: tint?.css }}
          hidden={phase === "captured" || kitReady}
        />

        {/* Camera Kit's rendered output. Mounted always so the canvas ref
            exists before the session boots; only shown once it is live. */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full object-contain"
          style={{ filter: tint?.css }}
          hidden={!kitReady || phase === "captured"}
        />

        {/* Face-tracked AR props (ours — see lib/ar), painted on a transparent
            overlay above whichever preview layer is showing. Sized to the
            video's own resolution so its landmark coordinates line up. */}
        <canvas
          ref={arCanvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
          style={{ filter: tint?.css }}
          hidden={phase === "captured"}
        />

        {/* Captured still. */}
        {captured ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={captured}
            alt="Captured"
            className="absolute inset-0 h-full w-full object-contain"
          />
        ) : null}

        {/* Countdown overlay. */}
        <AnimatePresence>
          {phase === "counting" && count > 0 ? (
            <motion.div
              key={count}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.6, opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <span className="font-display text-[9rem] font-extrabold text-white drop-shadow-lg">
                {count}
              </span>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80 p-6 text-center text-sm text-white">
            <p className="max-w-sm text-balance">{error}</p>
            <button
              onClick={() => setAttempt((n) => n + 1)}
              className="rounded-full border-[3px] border-ink bg-cream-light px-5 py-2 font-display font-bold text-ink shadow-[3px_3px_0_var(--color-ink)]"
            >
              Try again
            </button>
          </div>
        ) : null}

        {/* Filter picker — overlaid on the preview so the guest sees the lens
            and the strip in one place, without the frame giving up any height.
            Snap lenses (when Camera Kit is up) sit first, then a divider, then
            the always-available colour tints, then a divider and our own
            face-tracked AR props (when the model finished loading). */}
        {phase !== "captured" ? (
          <div className="absolute inset-x-0 bottom-0 overflow-x-auto bg-gradient-to-t from-black/55 to-transparent px-4 pb-3 pt-8">
            <div className="mx-auto flex w-max snap-x items-center gap-3">
              {kitReady && lenses.length > 0 ? (
                <>
                  <FilterChip
                    label="No filter"
                    fallback="🚫"
                    active={activeLensId === null}
                    onClick={() => selectLens(null)}
                  />
                  {lenses.map((lens) => (
                    <FilterChip
                      key={lens.id}
                      label={lens.name}
                      icon={lens.iconUrl}
                      active={activeLensId === lens.id}
                      onClick={() => selectLens(lens)}
                    />
                  ))}
                  <span
                    aria-hidden
                    className="mx-1 h-8 w-px shrink-0 rounded bg-white/25"
                  />
                </>
              ) : null}
              {CSS_FILTERS.map((f) => (
                <FilterChip
                  key={f.id}
                  label={f.name}
                  fallback={f.emoji}
                  active={tintId === f.id}
                  onClick={() =>
                    setTintId((cur) => (cur === f.id ? null : f.id))
                  }
                />
              ))}
              {arReady ? (
                <>
                  <span
                    aria-hidden
                    className="mx-1 h-8 w-px shrink-0 rounded bg-white/25"
                  />
                  {FACE_LENSES.map((f) => (
                    <FilterChip
                      key={f.id}
                      label={f.name}
                      fallback={f.emoji}
                      active={faceLensId === f.id}
                      onClick={() =>
                        setFaceLensId((cur) => (cur === f.id ? null : f.id))
                      }
                    />
                  ))}
                </>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {phase === "captured" ? (
          <>
            <button
              onClick={startOver}
              disabled={saving}
              className="rounded-full border-[3px] border-ink bg-cream-light px-6 py-2.5 font-display font-bold text-ink shadow-[3px_3px_0_var(--color-ink)] transition-transform hover:-translate-y-0.5 disabled:opacity-40"
            >
              Start over
            </button>
            <button
              onClick={retake}
              disabled={saving}
              className="rounded-full border-[3px] border-ink bg-cream-light px-6 py-2.5 font-display font-bold text-ink shadow-[3px_3px_0_var(--color-ink)] transition-transform hover:-translate-y-0.5 disabled:opacity-40"
            >
              Retake
            </button>
            <button
              onClick={usePhoto}
              disabled={saving}
              className="rounded-full border-[3px] border-ink bg-brand-orange px-6 py-2.5 font-display font-bold text-white shadow-[3px_3px_0_var(--color-ink)] transition-transform hover:-translate-y-0.5 disabled:opacity-60"
            >
              {saving ? "Sending…" : "Use this photo"}
            </button>
          </>
        ) : (
          <>
            {onExit ? (
              <button
                onClick={onExit}
                className="rounded-full border-[3px] border-ink bg-cream-light px-6 py-2.5 font-display font-bold text-ink shadow-[3px_3px_0_var(--color-ink)] transition-transform hover:-translate-y-0.5"
              >
                Back
              </button>
            ) : null}
            <button
              onClick={startCountdown}
              disabled={phase === "counting" || !!error}
              className="rounded-full border-[3px] border-ink bg-brand-orange px-8 py-2.5 font-display font-bold text-white shadow-[3px_3px_0_var(--color-ink)] transition-transform hover:-translate-y-0.5 disabled:opacity-40"
            >
              {phase === "counting" ? "Smile!" : "Start countdown"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * One entry in the filter strip: a small translucent circle sitting on the live
 * preview. The lens name is the accessible name and the tooltip rather than
 * visible text — labels under every circle crowd the frame and, with enough
 * lenses, push the row into a scroll no one at a kiosk will discover.
 */
function FilterChip({
  label,
  icon,
  fallback = "🥔",
  active,
  onClick,
}: {
  label: string;
  icon?: string;
  /** Shown when the lens ships no icon of its own. */
  fallback?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={label}
      aria-label={label}
      className={`grid h-12 w-12 shrink-0 snap-start place-items-center overflow-hidden rounded-full border-2 backdrop-blur-sm transition-transform hover:scale-105 ${
        active
          ? "border-brand-orange bg-brand-orange/40 scale-110"
          : "border-white/50 bg-white/15"
      }`}
    >
      {icon ? (
        // Lens icons are served from Snap's CDN; next/image would need each
        // host allow-listed, and these are small decorative thumbnails.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={icon} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="text-lg leading-none">{fallback}</span>
      )}
    </button>
  );
}
