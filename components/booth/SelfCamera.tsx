"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

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
 */
export function SelfCamera({ onExit }: { onExit: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [phase, setPhase] = useState<Phase>("preview");
  const [count, setCount] = useState(3);
  const [captured, setCaptured] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 1280, height: 1280 },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      console.error("[booth] camera error", err);
      setError(
        "Couldn't access the camera. Grant permission and make sure you're on https:// (use `pnpm dev:lan`).",
      );
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // Acquire the camera on mount, release it on unmount.
  useEffect(() => {
    startCamera();
    return stopCamera;
  }, [startCamera, stopCamera]);

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
    const size = Math.min(video.videoWidth, video.videoHeight) || 720;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Center-crop to a square and mirror (selfie view).
    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;
    ctx.translate(size, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);
    setCaptured(canvas.toDataURL("image/jpeg", 0.92));
    setPhase("captured");
  }, []);

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
    onExit();
  };

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-6">
      <div className="relative aspect-square w-full overflow-hidden rounded-3xl bg-black shadow-2xl">
        {/* Live preview (hidden once we have a capture). */}
        <video
          ref={videoRef}
          playsInline
          muted
          className="h-full w-full object-cover -scale-x-100"
          hidden={phase === "captured"}
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
              <span className="text-[9rem] font-bold text-white drop-shadow-lg">
                {count}
              </span>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {error ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-6 text-center text-sm text-white">
            {error}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {phase === "captured" ? (
          <>
            <button
              onClick={retake}
              className="rounded-full border border-foreground/20 px-6 py-3 font-medium hover:bg-foreground/5"
            >
              Retake
            </button>
            <button
              onClick={usePhoto}
              className="rounded-full bg-foreground px-6 py-3 font-medium text-background hover:opacity-90"
            >
              Use this photo
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onExit}
              className="rounded-full border border-foreground/20 px-6 py-3 font-medium hover:bg-foreground/5"
            >
              Back
            </button>
            <button
              onClick={startCountdown}
              disabled={phase === "counting" || !!error}
              className="rounded-full bg-foreground px-8 py-3 font-medium text-background hover:opacity-90 disabled:opacity-40"
            >
              {phase === "counting" ? "Smile!" : "Start countdown"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
