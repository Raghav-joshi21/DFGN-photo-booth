"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import type { Lens } from "@snap/camera-kit";

import {
  hasCameraKitEnv,
  startCameraKit,
  type CameraKitHandle,
} from "@/lib/camera-kit";
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

/** Below Tailwind's `sm`, where the preview is portrait. Keep in step with the
 *  `aspect-[2/3] sm:aspect-[16/9]` classes on the frame element. */
const FRAME_PORTRAIT_QUERY = "(max-width: 639px)";
const IDFW_FRAME_PORTRAIT = "/art/idfw-frame-portrait.webp";
const IDFW_FRAME_LANDSCAPE = "/art/idfw-frame-landscape.webp";

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
  const capturedBlob = useRef<Blob | null>(null);
  // The frame is portrait on a phone and 16:9 on a booth screen, so the crop
  // has to be read from the rendered box rather than hard-coded.
  const frameRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Bumping this re-runs the acquire effect (the "Try again" button).
  const [attempt, setAttempt] = useState(0);

  // Which camera to use. Phones have a rear one worth reaching for (the room,
  // the crowd); a laptop generally has one camera and no switch is offered.
  const [facing, setFacing] = useState<"user" | "environment">("user");

  // The preview box takes the camera's OWN aspect ratio rather than a fixed
  // one. A fixed shape forces a choice between cropping the view or padding it
  // with black bars; matching the source needs neither. Null until the first
  // frame arrives, when the CSS fallbacks below apply.
  const [videoAspect, setVideoAspect] = useState<number | null>(null);
  const [hasTwoCameras, setHasTwoCameras] = useState(false);

  // --- Snap Camera Kit (optional live filters) ---------------------------
  // `lens === null` is the always-available "no filter" option. The potato
  // lens is applied on start-up when the group ships one, so a guest who
  // ignores the strip still gets the house look.
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const kitRef = useRef<CameraKitHandle | null>(null);
  const [lenses, setLenses] = useState<Lens[]>([]);
  const [activeLensId, setActiveLensId] = useState<string | null>(null);
  const [kitReady, setKitReady] = useState(false);

  // Set once the stream exists, so the Camera Kit effect can wait for it.
  const [streamReady, setStreamReady] = useState(false);

  // Is there a second camera to switch to?
  //
  // Deliberately gated on `streamReady`: before permission is granted browsers
  // under-report this list — Safari hands back a single placeholder entry —
  // so probing at mount always said "one camera" and the switch never
  // appeared. Once the stream is live the list is complete.
  //
  // The `facingMode` fallback covers the case where the count is still
  // unhelpful: a device that reports a rear-facing camera has two by
  // definition, and phones support that even when enumeration is coy.
  useEffect(() => {
    if (!streamReady) return;
    let cancelled = false;
    navigator.mediaDevices
      ?.enumerateDevices?.()
      .then((ds) => {
        if (cancelled) return;
        const cams = ds.filter((d) => d.kind === "videoinput");
        const supportsFacing =
          "getSupportedConstraints" in navigator.mediaDevices &&
          !!navigator.mediaDevices.getSupportedConstraints().facingMode;
        const coarse = window.matchMedia("(pointer: coarse)").matches;
        setHasTwoCameras(cams.length > 1 || (supportsFacing && coarse));
      })
      .catch(() => setHasTwoCameras(false));
    return () => {
      cancelled = true;
    };
  }, [streamReady, attempt]);

  // --- Face-tracked AR lenses (ours, no Snap account) ---------------------
  // Runs off the raw <video> regardless of Camera Kit, drawing onto its own
  // transparent overlay canvas painted on top of whichever preview is showing.
  // See lib/ar. `arReady` gates whether the AR chips even appear.
  const arCanvasRef = useRef<HTMLCanvasElement>(null);
  const [arReady, setArReady] = useState(false);
  const [faceLensId, setFaceLensId] = useState<string | null>(null);

  // Snap lenses and our own face-tracked props are ONE picker as far as the
  // guest is concerned: choosing from either replaces whatever was on. They
  // are separate pieces of state because they are driven by different
  // engines, so every place that sets one has to clear the other.
  const activeLensIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeLensIdRef.current = activeLensId;
  }, [activeLensId]);

  // --- IDFW event frame ---------------------------------------------------
  // A branded border laid over the shot and baked into the capture. Two
  // artworks: a 2:3 portrait one and a 16:9 landscape one, matching the two
  // shapes the preview takes — which is why the preview's aspect ratios are
  // exactly those, so the border lands on the edges with nothing cropped.
  const [frameOn, setFrameOn] = useState(false);
  const frameImgRef = useRef<HTMLImageElement>(null);
  // Which artwork to use before the camera has reported its shape. Once it
  // has, `videoAspect` decides instead — the border follows the photo's
  // orientation, not the window's.
  const [framePortrait, setFramePortrait] = useState(false);
  useEffect(() => {
    // Must track the same breakpoint the fallback aspect classes use, or the
    // border would be drawn at the wrong shape for that one first frame.
    const mq = window.matchMedia(FRAME_PORTRAIT_QUERY);
    const sync = () => setFramePortrait(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
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
        // No width/height ideals on purpose. Asking for a particular shape
        // makes the browser pick a mode that matches it, which on a phone
        // means a cropped-in sensor read — the selfie comes out tighter than
        // what the camera can actually see. Asking only for a facing mode
        // gets the camera's own widest view, and nothing here crops it:
        // the preview and the capture both fit it whole into the frame.
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing } },
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
        const readAspect = () => {
          if (video.videoWidth && video.videoHeight) {
            setVideoAspect(video.videoWidth / video.videoHeight);
          }
        };
        video.addEventListener("loadedmetadata", readAspect);
        video.addEventListener("resize", readAspect);
        readAspect();
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
  }, [attempt, facing]);

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
        // The AR boot below may already have put the potato hat on: whichever
        // finishes last would otherwise leave both showing. The Snap lens is
        // the richer effect, so it wins and clears the prop.
        setFaceLensId(null);
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
      // House style: the potato hat leads — but only when no Snap lens is
      // already on, so the booth never starts with two effects at once. Only
      // sets it the first time, so it doesn't clobber a guest's own pick
      // across a "Try again" re-run.
      setFaceLensId((cur) =>
        cur ?? (activeLensIdRef.current ? null : "potato-hat"),
      );

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
          const faces = ar.detect(video, now);
          // One mouth per face: in the catch game everybody in frame plays.
          const mouths = gameOnRef.current
            ? faces.map((lm) => computeMouth(lm, canvas.width, canvas.height))
            : [];

          // Catch-game step: reuses the same landmarks already detected above
          // for the face lens — no extra detection call needed.
          if (gameOnRef.current && phaseRef.current !== "captured") {
            spawnAccRef.current += dt;
            if (spawnAccRef.current > 900) {
              spawnAccRef.current = 0;
              spawnPotato(potatoesRef.current, canvas.width);
            }
            const result = stepPotatoes(potatoesRef.current, dt, canvas.height, mouths);
            potatoesRef.current = result.potatoes;
            if (result.eaten > 0) {
              eatenRef.current += result.eaten;
              setEaten(eatenRef.current);
            }
          }

          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const lensId = faceLensIdRef.current;
            if (lensId) {
              // Every face in frame gets the prop, so a group shot works.
              for (const lm of faces) {
                drawFaceLens(ctx, lm, lensId, canvas.width, canvas.height, now);
              }
            }
            if (gameOnRef.current) {
              for (const p of potatoesRef.current) drawFallingPotato(ctx, p);
              for (const m of mouths) drawMouthRing(ctx, m);
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
    // Takes over from any face-tracked prop — and "No filter" means none of
    // either, not "no Snap lens but keep the hat".
    setFaceLensId(null);
    try {
      if (lens) await kit.session.applyLens(lens);
      else await kit.session.removeLens();
    } catch (err) {
      console.warn("[booth] could not apply lens", err);
      setActiveLensId(null);
    }
  }, []);

  /**
   * Pick a face-tracked prop, or tap the active one again to turn it off.
   * Removes any Snap lens for the same reason `selectLens` clears this one.
   */
  const selectFaceLens = useCallback((id: string) => {
    setFaceLensId((cur) => (cur === id ? null : id));
    const kit = kitRef.current;
    if (kit && activeLensIdRef.current) {
      setActiveLensId(null);
      kit.session.removeLens().catch((err) => {
        console.warn("[booth] could not remove lens", err);
      });
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

    if (!srcW || !srcH) return;

    // The whole camera frame at its own size: no crop, and no letterbox
    // either, because the preview box is this same shape.
    const canvas = document.createElement("canvas");
    canvas.width = srcW;
    canvas.height = srcH;
    const dx = 0;
    const dy = 0;
    const drawW = srcW;
    const drawH = srcH;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Not mirrored: the print should match what the guest saw on screen, and a
    // mirrored frame reverses any lens text along with it.
    ctx.drawImage(source, dx, dy, drawW, drawH);
    // Face-tracked AR props live on their own canvas (see arCanvasRef), sized
    // to the same video frame — composite it in with the same crop so the
    // print matches what the guest saw.
    const arCanvas = arCanvasRef.current;
    if ((faceLensId || gameOn) && arCanvas && arCanvas.width > 0) {
      ctx.drawImage(arCanvas, dx, dy, drawW, drawH);
    }
    // The event frame goes on last so it sits above everything, and is drawn
    // across the whole canvas rather than cropped: the canvas already has the
    // artwork's aspect ratio, so this is a straight scale.
    const frameImg = frameImgRef.current;
    if (frameOn && frameImg?.complete && frameImg.naturalWidth > 0) {
      ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height);
    }
    setCaptured(canvas.toDataURL("image/jpeg", 0.92));
    // Also keep the raw bytes: uploading the blob avoids the third that base64
    // adds to every frame on its way to Storage.
    canvas.toBlob((blob) => (capturedBlob.current = blob), "image/jpeg", 0.92);
    setPhase("captured");
  }, [kitReady, faceLensId, gameOn, frameOn]);

  const startCountdown = () => {
    setCount(3);
    setPhase("counting");
  };

  const retake = () => {
    setCaptured(null);
    capturedBlob.current = null;
    setPhase("preview");
  };

  /**
   * "Start over" on the review screen: drop the shot and go back to the live
   * preview without saving, and reset the filters to the booth's defaults so
   * the next guest starts clean.
   */
  const startOver = () => {
    retake();
    setFrameOn(false);
    setGameOn(false);
    setEaten(0);
    eatenRef.current = 0;
    potatoesRef.current = [];

    // Back to the house default — one effect, picked the same way the boot
    // above picks it: the Snap potato lens when there is one, our own potato
    // hat otherwise. Never both.
    const kit = kitRef.current;
    const snapDefault = kit?.defaultLens ?? null;
    setActiveLensId(snapDefault?.id ?? null);
    setFaceLensId(snapDefault ? null : arReady ? "potato-hat" : null);
    if (kit) {
      (snapDefault
        ? kit.session.applyLens(snapDefault)
        : kit.session.removeLens()
      ).catch(() => setActiveLensId(null));
    }
  };

  const usePhoto = async () => {
    const blob = capturedBlob.current;
    if (captured && blob && !saving) {
      setSaving(true);
      try {
        await savePhoto(blob, "booth");
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
    <div className="flex h-full min-h-0 w-full flex-col items-center gap-3">
      {/* Sizing the frame off the viewport (the old `100vh - 13rem`) meant
          guessing how tall the header and buttons were, so the camera came out
          a different size on every screen shape. This box is a size container
          instead, and `100cqh` below is the height actually left over after its
          siblings — no guess, and correct in any window.

          It must be `container-type: size`, not Tailwind's `@container`
          (inline-size): cqh only resolves under size containment, and without
          it the max-width is dropped and max-height squashes the frame off
          16:9. */}
      <div className="flex min-h-0 w-full flex-1 items-center justify-center [container-type:size]">
        <div
          ref={frameRef}
          // The aspect classes are the pre-camera fallback; once the stream
          // reports its size the inline style takes over and the box becomes
          // exactly the camera's shape.
          style={
            videoAspect
              ? {
                  aspectRatio: String(videoAspect),
                  maxWidth: `calc(100cqh * ${videoAspect})`,
                }
              : undefined
          }
          className="relative mx-auto aspect-[2/3] max-h-full w-full max-w-[calc(100cqh*2/3)] overflow-hidden rounded-[26px] border-[4px] border-ink bg-black shadow-[8px_8px_0_var(--color-ink)] sm:aspect-[16/9] sm:max-w-[calc(100cqh*16/9)]"
        >
        {/* Live preview (hidden once we have a capture). */}
        <video
          ref={videoRef}
          playsInline
          muted
          className="h-full w-full object-cover"
          hidden={phase === "captured" || kitReady}
        />

        {/* Camera Kit's rendered output. Mounted always so the canvas ref
            exists before the session boots; only shown once it is live. */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full object-cover"
          hidden={!kitReady || phase === "captured"}
        />

        {/* Face-tracked AR props (ours — see lib/ar), painted on a transparent
            overlay above whichever preview layer is showing. Sized to the
            video's own resolution so its landmark coordinates line up. */}
        <canvas
          ref={arCanvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          hidden={phase === "captured"}
        />

        {/* Catch-game score, while it's on. */}
        {gameOn && phase !== "captured" ? (
          <span className="absolute left-3 top-3 z-20 rounded-full bg-black/55 px-2.5 py-1 font-display text-[11px] font-semibold text-white backdrop-blur-sm">
            🥔 Eaten: {eaten}
          </span>
        ) : null}

        {/* Flip between the front and rear camera. Only when the device
            actually has both, which keeps it off single-camera booth screens
            without hard-coding "phones only". Sits opposite Snap's badge. */}
        {hasTwoCameras && phase === "preview" ? (
          <button
            type="button"
            onClick={() =>
              setFacing((f) => (f === "user" ? "environment" : "user"))
            }
            aria-label={
              facing === "user" ? "Switch to the rear camera" : "Switch to the front camera"
            }
            title={facing === "user" ? "Rear camera" : "Front camera"}
            className="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full border-2 border-white/50 bg-black/45 text-white backdrop-blur-sm transition-transform hover:scale-105 active:scale-95"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
              <path
                d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.4l1-1.6h6.2l1 1.6h1.4A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-8Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <path
                d="M9.8 12.4a2.6 2.6 0 0 1 4.4-1.7m0 0h-1.7m1.7 0v-1.7M14.2 13a2.6 2.6 0 0 1-4.4 1.7m0 0h1.7m-1.7 0v1.7"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : null}

        {/* Event frame, over the live preview. Mounted whenever it is on (not
            gated on phase) so the element is decoded and ready for the capture
            to draw. `next/image` is skipped deliberately: the capture needs the
            raw element and its natural size. */}
        {frameOn ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={frameImgRef}
            src={
              (videoAspect ? videoAspect < 1 : framePortrait)
                ? IDFW_FRAME_PORTRAIT
                : IDFW_FRAME_LANDSCAPE
            }
            alt=""
            aria-hidden
            // Stretched to the box (which is the camera's own shape), so
            // the border always meets the edges. The two artworks are close
            // enough to real camera ratios that the give is imperceptible.
            className="pointer-events-none absolute inset-0 z-10 h-full w-full"
            hidden={phase === "captured"}
          />
        ) : null}

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
              className="absolute inset-0 z-20 flex items-center justify-center"
            >
              <span className="font-display text-[9rem] font-extrabold text-white drop-shadow-lg">
                {count}
              </span>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {error ? (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/80 p-6 text-center text-sm text-white">
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
            Snap lenses (when Camera Kit is up) sit first, then the IDFW event
            frame, then a divider and our own face-tracked AR props (when the
            model finished loading). */}
        {phase !== "captured" ? (
          <div className="absolute inset-x-0 bottom-0 z-20 overflow-x-auto bg-gradient-to-t from-black/55 to-transparent px-4 pb-3 pt-8">
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
              <FilterChip
                label="IDFW frame"
                icon="/art/latvia-idfw26.png"
                active={frameOn}
                onClick={() => setFrameOn((on) => !on)}
              />
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
                        selectFaceLens(f.id)
                      }
                    />
                  ))}
                </>
              ) : null}
            </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-center gap-2.5 pb-1">
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
              onClick={() => setGameOn((v) => !v)}
              disabled={phase === "counting"}
              className={`rounded-full border-[3px] border-ink px-5 py-2.5 font-display font-bold shadow-[3px_3px_0_var(--color-ink)] transition-transform hover:-translate-y-0.5 disabled:opacity-40 ${
                gameOn ? "bg-brand-green text-white" : "bg-cream-light text-ink"
              }`}
            >
              🥔 Catch game{gameOn ? `: ${eaten}` : ""}
            </button>
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
