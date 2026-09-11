"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Lens } from "@snap/camera-kit";

import {
  hasCameraKitEnv,
  startCameraKit,
  type CameraKitHandle,
} from "@/lib/camera-kit";
import { FACE_LENSES, startFaceAr, type FaceArHandle } from "@/lib/ar";
import {
  computeMouth,
  playCatchSound,
  playComboBonusSound,
  playMilestoneSound,
  playRottenSound,
  drawFallingPotato,
  drawMouthRing,
  drawParticles,
  drawPopups,
  spawnCatchParticles,
  spawnMilestoneBurst,
  spawnPotato,
  spawnScorePopup,
  stepParticles,
  stepPopups,
  stepPotatoes,
  type CatchParticle,
  type FallingPotato,
  type ScorePopup,
} from "@/lib/ar/catch-game";
import { drawFaceLens } from "@/lib/ar/draw";
import { savePhoto } from "@/lib/photos/save";

type Phase = "preview" | "captured";

/** One entry in the filter carousel. */
interface CarouselItem {
  key: string;
  label: string;
  /** Lens-supplied thumbnail, when there is one. */
  icon?: string;
  /** Emoji or short word, when there is not. */
  fallback?: string;
}

/** Below Tailwind's `sm`, where the preview is portrait. Keep in step with the
 *  `aspect-[2/3] sm:aspect-[16/9]` classes on the frame element. */
const FRAME_PORTRAIT_QUERY = "(max-width: 639px)";
/** The two shapes the booth shoots in: 9:16 on a phone, 16:9 everywhere else. */
const PORTRAIT_ASPECT = 9 / 16;
const LANDSCAPE_ASPECT = 16 / 9;
const IDFW_FRAME_PORTRAIT = "/art/idfw-frame-portrait.webp";
const IDFW_FRAME_LANDSCAPE = "/art/idfw-frame-landscape.webp";
/** Catches within this many ms of each other extend the catch-game combo. */
const COMBO_WINDOW_MS = 1400;
/** Length of one catch-game round, once the "3, 2, 1, GO!" countdown ends. */
const ROUND_MS = 30_000;
/** The "3, 2, 1" beats before a round starts — GO! gets the last, shorter one. */
const COUNTDOWN_BEATS = [3, 2, 1, 0] as const; // 0 stands in for "GO!"
const COUNTDOWN_BEAT_MS = 700;
/** Score milestones worth a confetti burst + fanfare. */
const MILESTONES = [10, 25, 50, 75, 100];
const HIGH_SCORE_KEY = "dfgn-booth-catch-high-score";
/** Every Nth consecutive good catch fires a big "+BONUS" callout on top of
 *  the potato's own value — the payoff for staying on a streak. */
const COMBO_BONUS_EVERY = 5;
const COMBO_BONUS_POINTS = 5;

/**
 * The official "IDFW '26 — Latvia" sticker sheet (public/stickers), cut out
 * per-sticker. Professional-category filters: each one stamps a single
 * sticker in the corner of the shot, rather than a face prop or a full-bleed
 * border. w/h are the source PNG's real pixel size, used to keep the stamp's
 * aspect ratio when it's drawn into the capture canvas.
 */
const IDFW_STICKERS: { id: string; label: string; src: string; w: number; h: number }[] = [
  { id: "st-peters-cathedral", label: "St. Peter's", src: "/stickers/idfw-st-peters-cathedral.png", w: 506, h: 560 },
  { id: "st-johns-cathedral", label: "St. John's", src: "/stickers/idfw-st-johns-cathedral.png", w: 560, h: 525 },
  { id: "riga-landscape", label: "Riga skyline", src: "/stickers/idfw-riga-landscape.png", w: 560, h: 379 },
  { id: "manor-house", label: "Manor house", src: "/stickers/idfw-manor-house.png", w: 480, h: 367 },
  { id: "potato-astronaut", label: "Astro potato", src: "/stickers/idfw-potato-astronaut.png", w: 355, h: 420 },
  { id: "potato-rocket", label: "Potato & rocket", src: "/stickers/idfw-potato-rocket.png", w: 389, h: 420 },
  { id: "astronaut-helmet", label: "Astro helmet", src: "/stickers/idfw-astronaut-helmet.png", w: 475, h: 480 },
  { id: "rocket", label: "Rocket", src: "/stickers/idfw-rocket.png", w: 300, h: 298 },
  { id: "amber-necklace", label: "Amber necklace", src: "/stickers/idfw-amber-necklace.png", w: 265, h: 320 },
  { id: "sun-sceptre", label: "Sun sceptre", src: "/stickers/idfw-sun-sceptre.png", w: 373, h: 380 },
  { id: "sun-face", label: "Sun face", src: "/stickers/idfw-sun-face.png", w: 252, h: 248 },
  { id: "moon-stars", label: "Moon & stars", src: "/stickers/idfw-moon-stars.png", w: 234, h: 244 },
  { id: "floral-wreath", label: "Floral wreath", src: "/stickers/idfw-floral-wreath.png", w: 480, h: 363 },
  { id: "flower-basket", label: "Flower basket", src: "/stickers/idfw-flower-basket.png", w: 460, h: 455 },
  { id: "mitten", label: "Mitten", src: "/stickers/idfw-mitten.png", w: 222, h: 340 },
  { id: "folk-rug", label: "Folk rug", src: "/stickers/idfw-folk-rug.png", w: 204, h: 340 },
  { id: "folk-clogs", label: "Folk clogs", src: "/stickers/idfw-folk-clogs.png", w: 420, h: 310 },
  { id: "oak-leaf", label: "Oak leaf", src: "/stickers/idfw-oak-leaf.png", w: 286, h: 380 },
  { id: "wheat-bundle", label: "Wheat bundle", src: "/stickers/idfw-wheat-bundle.png", w: 183, h: 380 },
  { id: "cheese-wedge", label: "Cheese wedge", src: "/stickers/idfw-cheese-wedge.png", w: 300, h: 283 },
  { id: "wooden-spoon", label: "Wooden spoon", src: "/stickers/idfw-wooden-spoon.png", w: 100, h: 280 },
  { id: "weathervane-rooster", label: "Weathervane", src: "/stickers/idfw-weathervane-rooster.png", w: 210, h: 300 },
  { id: "star-yellow", label: "Star (yellow)", src: "/stickers/idfw-star-yellow.png", w: 84, h: 83 },
  { id: "star-maroon", label: "Star (maroon)", src: "/stickers/idfw-star-maroon.png", w: 83, h: 83 },
  { id: "star-tan", label: "Star (tan)", src: "/stickers/idfw-star-tan.png", w: 84, h: 83 },
  { id: "star-navy", label: "Star (navy)", src: "/stickers/idfw-star-navy.png", w: 84, h: 82 },
];

/**
 * Self-camera capture screen for the booth.
 *
 * Live webcam preview → tap to capture a frame to a canvas → show
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
        // Touch input is the gate, not the camera count: a desktop with a
        // second webcam has no "front" and "rear" to flip between, and the
        // booth screen should not offer a control nobody there can use.
        const coarse = window.matchMedia("(pointer: coarse)").matches;
        setHasTwoCameras(coarse && (cams.length > 1 || supportsFacing));
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
  // Which artwork to use — the same breakpoint that decides the shape being
  // shot, so the border always matches it.
  const [framePortrait, setFramePortrait] = useState(false);
  useEffect(() => {
    // Must track the same breakpoint the aspect classes use, or the border
    // would be drawn at the wrong shape.
    const mq = window.matchMedia(FRAME_PORTRAIT_QUERY);
    const sync = () => setFramePortrait(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // --- IDFW stickers (Professional category) -------------------------------
  // A single sticker stamped in the corner of the shot, baked into the
  // capture the same way the event frame is. Only one of frame / sticker /
  // lens is ever on at once — see `applySelection`.
  const [stickerId, setStickerId] = useState<string | null>(null);
  const stickerImgRef = useRef<HTMLImageElement>(null);

  // The rAF loop below reads the selection through a ref so picking a new
  // lens doesn't need to tear down and restart the detection loop.
  const faceLensIdRef = useRef<string | null>(null);
  useEffect(() => {
    faceLensIdRef.current = faceLensId;
  }, [faceLensId]);

  // --- "Catch the falling potatoes" mode ----------------------------------
  // Runs right inside this same preview and the same detection loop below —
  // no separate screen, no second camera stream. A timed round, not an
  // open-ended toggle: tapping the game button runs a "3, 2, 1, GO!"
  // countdown, then a 30s round, then a results card with the final score,
  // best combo, and a localStorage high score. Open your mouth under a
  // potato to eat it — plain ones are +1, a rare golden one is +3 with its
  // own sound and sparkle burst, and a rotten one (🤢) is -1 and breaks the
  // combo, so it's not just catch-everything. Consecutive good catches build
  // a combo (pitch climbs, a "×N combo!" popup fires) as long as they land
  // within COMBO_WINDOW_MS of each other, and every score milestone (see
  // MILESTONES) gets its own confetti burst and fanfare.
  type GameStage = "off" | "countdown" | "playing" | "results";
  const [stage, setStage] = useState<GameStage>("off");
  const stageRef = useRef<GameStage>("off");
  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  const [eaten, setEaten] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [countdownBeat, setCountdownBeat] = useState<number>(COUNTDOWN_BEATS[0]);
  const [highScore, setHighScore] = useState(0);
  const [results, setResults] = useState<{ score: number; bestCombo: number; isNewHigh: boolean } | null>(
    null,
  );

  const eatenRef = useRef(0);
  const timeLeftRef = useRef(0);
  const highScoreRef = useRef(0);
  const potatoesRef = useRef<FallingPotato[]>([]);
  const particlesRef = useRef<CatchParticle[]>([]);
  const popupsRef = useRef<ScorePopup[]>([]);
  const spawnAccRef = useRef(0);
  const lastFrameRef = useRef(0);
  const roundEndAtRef = useRef(0);
  // Which score milestones this round has already celebrated, so a guest who
  // lingers at (say) 10 doesn't get the confetti burst fired every frame.
  const milestoneHitRef = useRef<Set<number>>(new Set());
  // Combo streak: resets once a catch is more than COMBO_WINDOW_MS after the
  // last one, rather than on a fixed timer, so a guest who's on a roll never
  // gets cut off mid-streak by a clock they can't see. A rotten catch also
  // resets it immediately, regardless of timing.
  const comboRef = useRef(0);
  const bestComboRef = useRef(0);
  const lastCatchAtRef = useRef(0);
  // Bumped on every catch and threaded onto the score badge's `key`, so its
  // CSS pop animation replays each time — see .catch-pulse in globals.css.
  const [pulseKey, setPulseKey] = useState(0);

  // Load the saved high score once. Best-effort: a kiosk in a private/locked
  // browser context just plays without one.
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0;
      highScoreRef.current = saved;
      setHighScore(saved);
    } catch {
      // No storage access — the round still plays, just without a "Best".
    }
  }, []);

  /** Wipe the board back to a fresh, un-started game. Also how "Start over"
   *  (after a capture) leaves the game for the next guest. */
  const resetGame = useCallback(() => {
    setStage("off");
    setResults(null);
    eatenRef.current = 0;
    setEaten(0);
    potatoesRef.current = [];
    particlesRef.current = [];
    popupsRef.current = [];
    comboRef.current = 0;
    bestComboRef.current = 0;
    milestoneHitRef.current.clear();
  }, []);

  /** Tapping the game button from "off": clear the board and start the
   *  countdown. */
  const startRound = useCallback(() => {
    eatenRef.current = 0;
    setEaten(0);
    potatoesRef.current = [];
    particlesRef.current = [];
    popupsRef.current = [];
    comboRef.current = 0;
    bestComboRef.current = 0;
    milestoneHitRef.current.clear();
    spawnAccRef.current = 0;
    setResults(null);
    setStage("countdown");
  }, []);

  // The "3, 2, 1, GO!" beats, then straight into "playing" with a fresh round
  // clock. A plain setInterval rather than the rAF loop below: it needs to
  // run even before that loop's face-model promise has resolved.
  useEffect(() => {
    if (stage !== "countdown") return;
    let i = 0;
    setCountdownBeat(COUNTDOWN_BEATS[0]);
    const id = setInterval(() => {
      i += 1;
      if (i >= COUNTDOWN_BEATS.length) {
        clearInterval(id);
        roundEndAtRef.current = performance.now() + ROUND_MS;
        setStage("playing");
        return;
      }
      setCountdownBeat(COUNTDOWN_BEATS[i]);
    }, COUNTDOWN_BEAT_MS);
    return () => clearInterval(id);
  }, [stage]);

  /** Round over — by the clock running out, or the guest ending it early.
   *  Scores the round, updates the high score, and shows the results card. */
  const endRound = useCallback(() => {
    const score = eatenRef.current;
    const isNewHigh = score > highScoreRef.current;
    if (isNewHigh) {
      highScoreRef.current = score;
      setHighScore(score);
      try {
        localStorage.setItem(HIGH_SCORE_KEY, String(score));
      } catch {
        // No storage access — the high score just won't survive a refresh.
      }
    }
    setResults({ score, bestCombo: bestComboRef.current, isNewHigh });
    potatoesRef.current = [];
    particlesRef.current = [];
    popupsRef.current = [];
    setStage("results");
  }, []);

  /** A brief screen shake for a golden catch, a rotten mistake, or a combo
   *  bonus — applied straight to the DOM node rather than through React
   *  state, so restarting it mid-shake (a fast run of catches) is just a
   *  reflow away instead of a re-render. See .catch-shake in globals.css. */
  const triggerShake = useCallback(() => {
    const el = frameRef.current;
    if (!el) return;
    el.classList.remove("catch-shake");
    void el.offsetWidth; // force reflow so a re-trigger restarts the animation
    el.classList.add("catch-shake");
  }, []);

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
        // Ask for the shape the booth shoots in, so the camera picks a mode
        // close to it and the crop below has almost nothing left to take. It
        // is an `ideal`, not an `exact`: a camera that cannot oblige still
        // works, it is just trimmed a little more.
        const wantPortrait = window.matchMedia(FRAME_PORTRAIT_QUERY).matches;
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
            aspectRatio: { ideal: wantPortrait ? PORTRAIT_ASPECT : LANDSCAPE_ASPECT },
          },
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
          const isPlaying = stageRef.current === "playing";
          // One mouth per face: in the catch game everybody in frame plays.
          const mouths = isPlaying
            ? faces.map((lm) => computeMouth(lm, canvas.width, canvas.height))
            : [];

          // Catch-game step: reuses the same landmarks already detected above
          // for the face lens — no extra detection call needed.
          if (isPlaying && phaseRef.current !== "captured") {
            const remaining = roundEndAtRef.current - now;
            const secs = Math.max(0, Math.ceil(remaining / 1000));
            if (secs !== timeLeftRef.current) {
              timeLeftRef.current = secs;
              setTimeLeft(secs);
            }

            if (remaining <= 0) {
              endRound();
            } else {
              // Difficulty ramps with score over the first ~15 points, then
              // holds — potatoes fall a little faster and a little more
              // often, capped well short of unfair for a kiosk guest.
              const difficulty = Math.min(eatenRef.current / 15, 1);
              const spawnInterval = 900 - difficulty * 350;
              const speedMul = 1 + difficulty * 0.5;

              spawnAccRef.current += dt;
              if (spawnAccRef.current > spawnInterval) {
                spawnAccRef.current = 0;
                spawnPotato(potatoesRef.current, canvas.width, speedMul);
              }
              const result = stepPotatoes(potatoesRef.current, dt, canvas.height, mouths);
              potatoesRef.current = result.potatoes;

              if (result.catches.length > 0) {
                let scoreGain = 0;
                for (const c of result.catches) {
                  scoreGain += c.value;

                  if (c.rotten) {
                    // Breaks the streak immediately — no grace window, unlike
                    // a plain gap in catches.
                    comboRef.current = 0;
                    spawnCatchParticles(particlesRef.current, c.x, c.y, "rotten");
                    spawnScorePopup(popupsRef.current, c.x, c.y, `${c.value} 🤢`, "#ff6b5e");
                    playRottenSound();
                    triggerShake();
                    continue;
                  }

                  spawnCatchParticles(particlesRef.current, c.x, c.y, c.golden ? "golden" : "normal");

                  // A catch within the window of the last one extends the
                  // combo; a gap resets it to 1 rather than to 0, since this
                  // catch itself starts the (possibly new) streak.
                  comboRef.current =
                    now - lastCatchAtRef.current < COMBO_WINDOW_MS ? comboRef.current + 1 : 1;
                  lastCatchAtRef.current = now;
                  if (comboRef.current > bestComboRef.current) bestComboRef.current = comboRef.current;

                  const popupText = c.golden
                    ? `+${c.value} GOLDEN!`
                    : comboRef.current >= 3
                      ? `+${c.value} ×${comboRef.current}!`
                      : `+${c.value}`;
                  spawnScorePopup(
                    popupsRef.current,
                    c.x,
                    c.y,
                    popupText,
                    c.golden ? "#ffe27a" : comboRef.current >= 3 ? "#f2c744" : "#ffffff",
                  );
                  playCatchSound({ combo: comboRef.current, golden: c.golden });
                  if (c.golden) triggerShake();

                  // Every Nth consecutive good catch: a big bonus callout,
                  // its own confetti burst, a punchier sound, and a shake —
                  // the payoff for staying on a streak, not just another +1.
                  if (comboRef.current % COMBO_BONUS_EVERY === 0) {
                    scoreGain += COMBO_BONUS_POINTS;
                    const bx = canvas.width / 2;
                    const by = canvas.height * 0.4;
                    spawnScorePopup(
                      popupsRef.current,
                      bx,
                      by,
                      `🔥 ×${comboRef.current} COMBO! +${COMBO_BONUS_POINTS}`,
                      "#ee8b2b",
                      true,
                    );
                    spawnMilestoneBurst(particlesRef.current, bx, by);
                    playComboBonusSound();
                    triggerShake();
                  }
                }

                eatenRef.current = Math.max(0, eatenRef.current + scoreGain);
                setEaten(eatenRef.current);
                setPulseKey((k) => k + 1);

                // Score milestones, checked against the post-catch total —
                // each one fires once per round.
                for (const m of MILESTONES) {
                  if (milestoneHitRef.current.has(m) || eatenRef.current < m) continue;
                  milestoneHitRef.current.add(m);
                  const mx = canvas.width / 2;
                  const my = canvas.height * 0.28;
                  spawnMilestoneBurst(particlesRef.current, mx, my);
                  spawnScorePopup(popupsRef.current, mx, my, `🎉 ${m} CAUGHT!`, "#f2c744", true);
                  playMilestoneSound();
                }
              }

              particlesRef.current = stepParticles(particlesRef.current, dt);
              popupsRef.current = stepPopups(popupsRef.current, dt);
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
            if (isPlaying) {
              for (const p of potatoesRef.current) drawFallingPotato(ctx, p);
              for (const m of mouths) drawMouthRing(ctx, m);
              drawParticles(ctx, particlesRef.current);
              drawPopups(ctx, popupsRef.current);
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

    // Fit to the shape the guest is looking at — 9:16 on a phone, 16:9 on a
    // booth screen — read off the rendered box so the print is exactly the
    // preview. Contain semantics, matching object-contain: the whole frame is
    // kept, letterboxed (not cropped) on whichever axis doesn't match, same
    // as the on-screen preview. The stream was requested at this ratio, so in
    // practice there is little or no letterboxing.
    const box = frameRef.current?.getBoundingClientRect();
    const targetAspect = box && box.height > 0 ? box.width / box.height : srcW / srcH;

    let canvasW = srcW;
    let canvasH = srcH;
    if (srcW / srcH > targetAspect) canvasH = srcW / targetAspect;
    else canvasW = srcH * targetAspect;
    const dx = (canvasW - srcW) / 2;
    const dy = (canvasH - srcH) / 2;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(canvasW);
    canvas.height = Math.round(canvasH);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Letterbox bars, matching the preview box's own bg-black.
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Not mirrored: the print should match what the guest saw on screen, and a
    // mirrored frame reverses any lens text along with it.
    ctx.drawImage(source, 0, 0, srcW, srcH, dx, dy, srcW, srcH);
    // Face-tracked AR props live on their own canvas (see arCanvasRef), sized
    // to the same video frame — composite it in at the same position so the
    // print matches what the guest saw.
    const arCanvas = arCanvasRef.current;
    if ((faceLensId || gameOn) && arCanvas && arCanvas.width > 0) {
      ctx.drawImage(arCanvas, 0, 0, srcW, srcH, dx, dy, srcW, srcH);
    }
    // The event frame goes on last so it sits above everything, and is drawn
    // across the whole canvas rather than cropped: the canvas already has the
    // artwork's aspect ratio, so this is a straight scale.
    const frameImg = frameImgRef.current;
    if (frameOn && frameImg?.complete && frameImg.naturalWidth > 0) {
      ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height);
    }
    // IDFW sticker stamp — a corner badge rather than a full-bleed border, at
    // the same margin/size fractions as the preview's CSS positioning below
    // so the print matches what the guest saw.
    const stickerImg = stickerImgRef.current;
    if (stickerId && stickerImg?.complete && stickerImg.naturalWidth > 0) {
      const marginX = canvas.width * 0.04;
      const marginY = canvas.height * 0.04;
      const stW = canvas.width * 0.3;
      const stH = stW * (stickerImg.naturalHeight / stickerImg.naturalWidth);
      ctx.drawImage(stickerImg, canvas.width - marginX - stW, canvas.height - marginY - stH, stW, stH);
    }
    setCaptured(canvas.toDataURL("image/jpeg", 0.92));
    // Also keep the raw bytes: uploading the blob avoids the third that base64
    // adds to every frame on its way to Storage.
    canvas.toBlob((blob) => (capturedBlob.current = blob), "image/jpeg", 0.92);
    setPhase("captured");
  }, [kitReady, faceLensId, gameOn, frameOn, stickerId]);

  // --- Filter carousel -----------------------------------------------------
  // Every effect the booth offers, as one list, because the carousel has one
  // selection: whichever chip is sitting in the middle. That subsumes the
  // separate Snap / face-prop / frame pickers, which is also why the IDFW
  // frame is no longer an independent toggle.
  //
  // The strip is split into two categories a guest can flip between: Fun (the
  // full spread — every face prop plus every Snap lens) and Professional (no
  // costumes — just the house potato hat, the IDFW event frame, a corner
  // stamp from the official sticker sheet, and no filter at all).
  const [category, setCategory] = useState<"fun" | "professional">("fun");

  const carousel = useMemo<CarouselItem[]>(() => {
    const items: CarouselItem[] = [];
    // First, not last: the carousel starts on "No filter", so that's what a
    // guest lands on before picking anything.
    items.push({ key: "none", label: "No filter", fallback: "🚫" });

    if (category === "professional") {
      const potato = arReady ? FACE_LENSES.find((f) => f.id === "potato-hat") : null;
      if (potato) {
        items.push({ key: `face:${potato.id}`, label: potato.name, fallback: potato.emoji });
      }
      items.push({ key: "frame", label: "IDFW frame", fallback: "IDFW" });
      for (const s of IDFW_STICKERS) {
        items.push({ key: `sticker:${s.id}`, label: s.label, icon: s.src });
      }
      return items;
    }

    // Fun: everything else.
    if (arReady) {
      for (const f of FACE_LENSES) {
        items.push({ key: `face:${f.id}`, label: f.name, fallback: f.emoji });
      }
    }
    items.push({ key: "frame", label: "IDFW frame", fallback: "IDFW" });
    if (kitReady) {
      for (const lens of lenses) {
        items.push({ key: `snap:${lens.id}`, label: lens.name, icon: lens.iconUrl });
      }
    }
    return items;
  }, [kitReady, lenses, arReady, category]);

  const [selectedKey, setSelectedKey] = useState("none");
  const stripRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef(new Map<string, HTMLButtonElement>());
  // Guards the scroll handler while a click-to-centre animation is in flight,
  // so the intermediate positions do not each count as a selection.
  const scrollingTo = useRef<string | null>(null);

  /** Put one effect on screen and take every other one off. */
  const applySelection = useCallback(
    (key: string) => {
      setSelectedKey(key);
      setFrameOn(key === "frame");
      setFaceLensId(key.startsWith("face:") ? key.slice(5) : null);
      setStickerId(key.startsWith("sticker:") ? key.slice(8) : null);

      const kit = kitRef.current;
      if (!kit) return;
      const wantSnap = key.startsWith("snap:") ? key.slice(5) : null;
      if (activeLensIdRef.current === wantSnap) return;
      setActiveLensId(wantSnap);
      const lens = wantSnap ? lenses.find((l) => l.id === wantSnap) : null;
      (lens ? kit.session.applyLens(lens) : kit.session.removeLens()).catch((err) => {
        console.warn("[booth] could not switch lens", err);
      });
    },
    [lenses],
  );

  /** Slide a chip into the middle; the scroll handler then selects it. */
  const centreChip = useCallback((key: string) => {
    const strip = stripRef.current;
    const chip = chipRefs.current.get(key);
    if (!strip || !chip) return;
    scrollingTo.current = key;
    strip.scrollTo({
      left: chip.offsetLeft - strip.clientWidth / 2 + chip.clientWidth / 2,
      behavior: "smooth",
    });
  }, []);

  // Whichever chip is nearest the middle is the selected one — the carousel
  // reads like Instagram's and Snapchat's, where scrolling *is* choosing.
  const onStripScroll = useCallback(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const middle = strip.scrollLeft + strip.clientWidth / 2;
    let bestKey: string | null = null;
    let bestDist = Infinity;
    for (const [key, el] of chipRefs.current) {
      const d = Math.abs(el.offsetLeft + el.clientWidth / 2 - middle);
      if (d < bestDist) {
        bestDist = d;
        bestKey = key;
      }
    }
    if (!bestKey) return;
    if (scrollingTo.current && scrollingTo.current !== bestKey) return;
    scrollingTo.current = null;
    if (bestKey !== selectedKey) applySelection(bestKey);
  }, [selectedKey, applySelection]);

  // Land on the first entry once the list exists, and keep it centred.
  //
  // Once only: the list grows as Camera Kit and the face model finish loading,
  // and re-running would yank a guest who had already chosen "No filter" back
  // onto the potato.
  const autoSelected = useRef(false);
  useEffect(() => {
    const first = carousel[0];
    if (autoSelected.current || !first || carousel.length < 2) return;
    autoSelected.current = true;
    applySelection(first.key);
    centreChip(first.key);
  }, [carousel, applySelection, centreChip]);

  // Switching Fun ↔ Professional swaps the whole list out from under the
  // guest, so land on the new list's first entry rather than leaving the
  // strip on a chip (or a selection) that may no longer exist in it.
  const prevCategoryRef = useRef(category);
  useEffect(() => {
    if (prevCategoryRef.current === category) return;
    prevCategoryRef.current = category;
    const first = carousel[0];
    if (!first) return;
    applySelection(first.key);
    centreChip(first.key);
  }, [category, carousel, applySelection, centreChip]);

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
    setGameOn(false);
    setEaten(0);
    eatenRef.current = 0;
    potatoesRef.current = [];

    // Back to the house default: "No filter", the carousel's first entry —
    // same landing spot a fresh guest gets.
    applySelection("none");
    centreChip("none");
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
          className="relative mx-auto aspect-[9/16] max-h-full w-full max-w-[calc(100cqh*9/16)] overflow-hidden rounded-[26px] border-[4px] border-ink bg-black shadow-[8px_8px_0_var(--color-ink)] sm:aspect-[16/9] sm:max-w-[calc(100cqh*16/9)]"
        >
        {/* Live preview (hidden once we have a capture). object-contain, not
            -cover: the whole shot is kept on screen, letterboxed rather than
            cropped, against the box's own bg-black. */}
        <video
          ref={videoRef}
          playsInline
          muted
          className="h-full w-full object-contain"
          hidden={phase === "captured" || kitReady}
        />

        {/* Camera Kit's rendered output. Mounted always so the canvas ref
            exists before the session boots; only shown once it is live. */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full object-contain"
          hidden={!kitReady || phase === "captured"}
        />

        {/* Face-tracked AR props (ours — see lib/ar), painted on a transparent
            overlay above whichever preview layer is showing. Sized to the
            video's own resolution so its landmark coordinates line up —
            object-contain here too, so it letterboxes identically and stays
            pixel-aligned with the layer underneath. */}
        <canvas
          ref={arCanvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
          hidden={phase === "captured"}
        />

        {/* Catch-game score, while it's on. Re-keyed on every catch so its
            CSS pop animation (see .catch-pulse in globals.css) replays. */}
        {gameOn && phase !== "captured" ? (
          <span
            key={pulseKey}
            className="catch-pulse absolute left-3 top-3 z-20 rounded-full bg-black/55 px-2.5 py-1 font-display text-[11px] font-semibold text-white backdrop-blur-sm"
          >
            🥔 Eaten: {eaten}
          </span>
        ) : null}

        {/* Top-right controls: the front/rear camera flip when the device has
            both, plus the Fun/Professional filter-category dropdown at the
            far right. Grouped in one flex row so neither ever has to guess
            around the other's width. */}
        {phase === "preview" ? (
          <div className="absolute right-3 top-3 z-20 flex items-center gap-2">
            {/* Flip between the front and rear camera. Only when the device
                actually has both, which keeps it off single-camera booth
                screens without hard-coding "phones only". */}
            {hasTwoCameras ? (
              <button
                type="button"
                onClick={() =>
                  setFacing((f) => (f === "user" ? "environment" : "user"))
                }
                aria-label={
                  facing === "user" ? "Switch to the rear camera" : "Switch to the front camera"
                }
                title={facing === "user" ? "Rear camera" : "Front camera"}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-white/50 bg-black/45 text-white backdrop-blur-sm transition-transform hover:scale-105 active:scale-95"
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

            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as "fun" | "professional")}
              aria-label="Filter category"
              className="h-10 rounded-full border-2 border-white/50 bg-black/45 px-3 font-display text-xs font-bold text-white backdrop-blur-sm outline-none transition-transform hover:scale-105"
            >
              <option value="fun">Fun</option>
              <option value="professional">Professional</option>
            </select>
          </div>
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
              framePortrait
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

        {/* IDFW sticker stamp, over the live preview. Mounted whenever one is
            picked (not gated on phase) so the element is decoded and ready
            for the capture to draw — same reasoning as the event frame
            above. Positioned as a bottom-right corner badge, in percentages
            so the CSS box matches the fractions `capture()` uses on the
            canvas. */}
        {stickerId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={stickerImgRef}
            src={IDFW_STICKERS.find((s) => s.id === stickerId)?.src}
            alt=""
            aria-hidden
            className="pointer-events-none absolute z-10 w-[30%] object-contain drop-shadow-md"
            style={{ right: "4%", bottom: "4%" }}
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

        {/* Filter carousel — overlaid on the preview, and the shutter.
            Whichever chip is in the middle is the selected effect, the way
            Instagram's and Snapchat's lens pickers work: scrolling is
            choosing. Tapping an off-centre chip brings it in; tapping the one
            already centred takes the photo. */}
        {phase !== "captured" ? (
          <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/60 to-transparent pb-3 pt-10">
            <div
              ref={stripRef}
              onScroll={onStripScroll}
              // The end padding is half the strip minus half a chip, so the
              // first and last entries can still reach the middle.
              className="no-scrollbar flex snap-x snap-mandatory items-center gap-4 overflow-x-auto px-[calc(50%-1.75rem)] py-1"
            >
              {carousel.map((item) => {
                const centred = item.key === selectedKey;
                return (
                  <button
                    key={item.key}
                    ref={(el) => {
                      if (el) chipRefs.current.set(item.key, el);
                      else chipRefs.current.delete(item.key);
                    }}
                    type="button"
                    onClick={() => (centred ? capture() : centreChip(item.key))}
                    aria-pressed={centred}
                    aria-label={centred ? `Take a photo with ${item.label}` : item.label}
                    title={item.label}
                    className={`grid shrink-0 snap-center place-items-center overflow-hidden rounded-full border-2 transition-all duration-200 ${
                      centred
                        ? "h-14 w-14 border-white bg-white/25 opacity-100 shadow-[0_0_0_3px_rgba(255,255,255,0.35)]"
                        : "h-11 w-11 border-white/40 bg-white/10 opacity-45 hover:opacity-70"
                    }`}
                  >
                    {item.icon ? (
                      // Lens icons come from Snap's CDN; next/image would need
                      // every host allow-listed for a decorative thumbnail.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.icon} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span
                        className={
                          (item.fallback ?? "").length > 2
                            ? "font-display text-[11px] font-extrabold uppercase leading-none tracking-tight text-white"
                            : "text-lg leading-none"
                        }
                      >
                        {item.fallback}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <p className="mt-1 text-center font-body text-[11px] text-white/70">
              Tap the centre filter to take the photo
            </p>
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
            {/* Catch game is a booth-screen amusement: on a phone it eats the
                preview and there is no crowd around it. */}
            <button
              onClick={() => setGameOn((v) => !v)}
              className={`hidden rounded-full border-[3px] border-ink px-5 py-2.5 font-display font-bold shadow-[3px_3px_0_var(--color-ink)] transition-transform hover:-translate-y-0.5 sm:inline-flex ${
                gameOn ? "bg-brand-green text-white" : "bg-cream-light text-ink"
              }`}
            >
              🥔 Catch game{gameOn ? `: ${eaten}` : ""}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
