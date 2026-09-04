/**
 * Home-grown, face-tracked AR — no Snap account needed.
 *
 * Runs MediaPipe's `FaceLandmarker` entirely client-side against the booth's
 * own webcam feed (`@mediapipe/tasks-vision`) and hands back the raw 478-point
 * face mesh every animation frame. `SelfCamera` draws the selected prop from
 * those points onto its own overlay canvas — see `drawFaceLens` in
 * [`./draw`](./draw.ts). This module only does detection; it knows nothing
 * about React or the booth's filter strip.
 *
 * Same spirit as `lib/camera-kit`: best-effort. The wasm runtime and the model
 * (~6MB combined) are pulled from a CDN on first use rather than bundled, so a
 * guest who never opens the AR chips never downloads them. If the model can't
 * load — offline, no WebGL, a slow device — `startFaceAr()` resolves `null`
 * and the caller just omits the AR chips; nothing else in the booth depends
 * on this.
 *
 * The `FaceLandmarker` instance is expensive to boot (multi-second first load)
 * and cheap to keep warm, so it's cached as a module-level singleton rather
 * than recreated per mount — `SelfCamera`'s acquire effect re-runs under
 * StrictMode and on "Try again", and re-downloading the model each time would
 * make the strip feel broken. It is intentionally never torn down for the
 * life of the tab.
 *
 * Future home for the face-tracking mini-game mentioned on the booth's game
 * screen ("catch the falling potatoes") — that game would consume the same
 * `detect()` landmarks this module already produces.
 */
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

export interface FaceLens {
  id: string;
  /** Accessible name + tooltip on the chip. */
  name: string;
  /** Shown in the chip. */
  emoji: string;
}

/** The face-tracked props on offer, in strip order. See `draw.ts` for how each renders. */
export const FACE_LENSES: FaceLens[] = [
  { id: "potato-hat", name: "Potato hat", emoji: "🥔" },
  { id: "shades", name: "Shades", emoji: "🕶️" },
  { id: "mustache", name: "Mustache", emoji: "👨" },
  { id: "crown", name: "Crown", emoji: "👑" },
  { id: "googly-eyes", name: "Googly eyes", emoji: "👀" },
];

export interface FaceArHandle {
  /**
   * Run detection against the current video frame. Returns the first face's
   * 478 normalized landmarks, or `null` when no face is in frame (or the same
   * video timestamp was already processed — call this at most once per
   * animation frame).
   */
  detect: (video: HTMLVideoElement, nowMs: number) => NormalizedLandmark[] | null;
}

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

let cached: Promise<FaceArHandle | null> | null = null;

/** Boot (once) and get the shared face-AR handle. Safe to call repeatedly. */
export function startFaceAr(): Promise<FaceArHandle | null> {
  if (!cached) cached = boot();
  return cached;
}

async function boot(): Promise<FaceArHandle | null> {
  try {
    const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
    const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);

    const create = (delegate: "GPU" | "CPU") =>
      FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate },
        runningMode: "VIDEO",
        numFaces: 1,
      });

    // GPU is faster but not available everywhere (some virtual displays /
    // sandboxed GPUs reject the WebGL context) — fall back to CPU rather than
    // losing AR over it.
    const landmarker = await create("GPU").catch(() => create("CPU"));

    let lastTimestamp = -1;
    return {
      detect(video, nowMs) {
        // detectForVideo requires a strictly increasing timestamp per call.
        if (nowMs <= lastTimestamp) return null;
        lastTimestamp = nowMs;
        if (video.readyState < 2) return null; // < HAVE_CURRENT_DATA: no frame yet
        const result = landmarker.detectForVideo(video, nowMs);
        return result.faceLandmarks[0] ?? null;
      },
    };
  } catch (err) {
    console.warn("[booth] face AR unavailable — AR lenses disabled", err);
    cached = null;
    return null;
  }
}
