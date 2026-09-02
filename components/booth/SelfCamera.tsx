"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import type { Lens } from "@snap/camera-kit";

import {
  hasCameraKitEnv,
  startCameraKit,
  type CameraKitHandle,
} from "@/lib/camera-kit";

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

  // Bumping this re-runs the acquire effect (the "Try again" button).
  const [attempt, setAttempt] = useState(0);

  // --- Snap Camera Kit (optional live filters) ---------------------------
  // `lens === null` is the always-available "no filter" option, and the
  // default: a guest who ignores the strip gets a plain photo.
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const kitRef = useRef<CameraKitHandle | null>(null);
  const [lenses, setLenses] = useState<Lens[]>([]);
  const [activeLensId, setActiveLensId] = useState<string | null>(null);
  const [kitReady, setKitReady] = useState(false);
  // Set once the stream exists, so the Camera Kit effect can wait for it.
  const [streamReady, setStreamReady] = useState(false);

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
          video: { facingMode: "user", width: { ideal: 1600 }, height: { ideal: 1200 } },
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
    // Center-crop to a square and mirror (selfie view).
    const sx = (srcW - size) / 2;
    const sy = (srcH - size) / 2;
    ctx.translate(size, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(source, sx, sy, size, size, 0, 0, size, size);
    setCaptured(canvas.toDataURL("image/jpeg", 0.92));
    setPhase("captured");
  }, [kitReady]);

  const startCountdown = () => {
    setCount(3);
    setPhase("counting");
  };

  const retake = () => {
    setCaptured(null);
    setPhase("preview");
  };

  const usePhoto = () => {
    // TODO(booth-capture): upload `captured` to Supabase Storage as a
    // source:'booth' photo, then play the Polaroid-eject animation as the
    // print "slides out" onto the wall. Stubbed for now.
    console.log("[booth] use photo (stub) — captured length:", captured?.length);
    if (onExit) onExit();
    else retake(); // Inline: hand the booth straight back to a live preview.
  };

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="relative mx-auto aspect-[4/3] w-full max-w-[calc((100vh-19rem)*4/3)] overflow-hidden rounded-[26px] border-[4px] border-ink bg-black shadow-[8px_8px_0_var(--color-ink)]">
        {/* Live preview (hidden once we have a capture). */}
        <video
          ref={videoRef}
          playsInline
          muted
          className="h-full w-full object-cover -scale-x-100"
          hidden={phase === "captured" || kitReady}
        />

        {/* Camera Kit's rendered output. Mounted always so the canvas ref
            exists before the session boots; only shown once it is live. */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full object-cover -scale-x-100"
          hidden={!kitReady || phase === "captured"}
        />

        {/* Captured still. */}
        {captured ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={captured}
            alt="Captured"
            className="absolute inset-0 h-full w-full object-cover"
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

        {/* Snap's guidelines require visible attribution whenever a Lens is
            active — see the Camera Kit section of the README. */}
        {kitReady && activeLensId && phase !== "captured" ? (
          <span className="absolute bottom-3 left-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
            Powered by Snap
          </span>
        ) : null}

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
      </div>

      {/* Filter picker — only when Camera Kit actually came up. */}
      {kitReady && lenses.length > 0 && phase !== "captured" ? (
        <div className="w-full">
          <p className="mb-2 text-center font-display text-sm font-bold uppercase tracking-wide text-ink/60">
            Pick a filter
          </p>
          <div className="flex w-full snap-x gap-2.5 overflow-x-auto pb-1">
            <FilterChip
              label="No filter"
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
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-center gap-3">
        {phase === "captured" ? (
          <>
            <button
              onClick={retake}
              className="rounded-full border-[3px] border-ink bg-cream-light px-6 py-2.5 font-display font-bold text-ink shadow-[3px_3px_0_var(--color-ink)] transition-transform hover:-translate-y-0.5"
            >
              Retake
            </button>
            <button
              onClick={usePhoto}
              className="rounded-full border-[3px] border-ink bg-brand-orange px-6 py-2.5 font-display font-bold text-white shadow-[3px_3px_0_var(--color-ink)] transition-transform hover:-translate-y-0.5"
            >
              Use this photo
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
 * One entry in the filter strip. Square thumbnail when the lens ships an icon,
 * otherwise the lens name — a strip of blank tiles would be unusable.
 */
function FilterChip({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={label}
      className={`flex shrink-0 snap-start flex-col items-center gap-1 rounded-xl border-[3px] px-2 py-1.5 transition-transform hover:-translate-y-0.5 ${
        active
          ? "border-ink bg-brand-orange text-white shadow-[3px_3px_0_var(--color-ink)]"
          : "border-ink/25 bg-cream-light text-ink"
      }`}
    >
      {icon ? (
        // Lens icons are served from Snap's CDN; next/image would need each
        // host allow-listed, and these are small decorative thumbnails.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={icon} alt="" className="h-10 w-10 rounded-md object-cover" />
      ) : (
        <span className="flex h-10 w-10 items-center justify-center rounded-md bg-ink/10 text-lg">
          🥔
        </span>
      )}
      <span className="max-w-[4.5rem] truncate font-display text-[11px] font-bold">
        {label}
      </span>
    </button>
  );
}
