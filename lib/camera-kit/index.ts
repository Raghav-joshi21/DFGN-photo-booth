/**
 * Snap Camera Kit integration for the booth's live filters.
 *
 * Everything here is best-effort. The booth must keep working when Camera Kit
 * is unconfigured, blocked, or simply broken — a failed filter layer degrades
 * to the plain webcam preview rather than taking the capture flow down with it.
 *
 * The SDK is ~7MB, so it is imported dynamically and only once the credentials
 * are actually present; an unconfigured booth never downloads it.
 */
import type { CameraKitSession, Lens } from "@snap/camera-kit";

/**
 * Only potato-themed lenses are offered. The lens group can hold anything, so
 * this filters by name rather than trusting the group's contents.
 */
const POTATO_LENS_PATTERN = /potato|spud|tater|tattie|fry|fries|chip|crisp|veg/i;

export interface CameraKitHandle {
  session: CameraKitSession;
  /** Potato lenses, in group order. "No filter" is handled by the UI. */
  lenses: Lens[];
  /** Every lens in the group, for diagnostics when the filter matches none. */
  totalLenses: number;
  destroy: () => void;
}

/** True when both Snap credentials are configured. */
export function hasCameraKitEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_CAMERA_KIT_API_TOKEN &&
      process.env.NEXT_PUBLIC_CAMERA_KIT_LENS_GROUP_ID,
  );
}

/**
 * Boot Camera Kit, bind it to an existing webcam stream, and render into
 * `canvas`. Returns null if anything goes wrong — callers fall back to the raw
 * preview. The stream is owned by the caller and is NOT stopped on destroy.
 */
export async function startCameraKit(
  stream: MediaStream,
  canvas: HTMLCanvasElement,
): Promise<CameraKitHandle | null> {
  if (!hasCameraKitEnv()) return null;

  try {
    const { bootstrapCameraKit } = await import("@snap/camera-kit");

    const cameraKit = await bootstrapCameraKit({
      apiToken: process.env.NEXT_PUBLIC_CAMERA_KIT_API_TOKEN!,
    });

    const session = await cameraKit.createSession({ liveRenderTarget: canvas });
    await session.setSource(stream);
    await session.play();

    const groupId = process.env.NEXT_PUBLIC_CAMERA_KIT_LENS_GROUP_ID!;
    const { lenses: allLenses, errors } = await cameraKit.lensRepository.loadLensGroups([groupId]);
    if (errors?.length) {
      console.warn("[booth] some lenses failed to load", errors);
    }

    const potato = allLenses.filter((lens) => POTATO_LENS_PATTERN.test(lens.name));

    // An empty picker is worse than an unfiltered one: if the group has lenses
    // but none look potato-themed, show them all and say why in the console,
    // rather than silently presenting a filter step that does nothing.
    const lenses = potato.length > 0 ? potato : allLenses;
    if (potato.length === 0 && allLenses.length > 0) {
      console.warn(
        `[booth] no lens in group ${groupId} matched ${POTATO_LENS_PATTERN}; ` +
          `showing all ${allLenses.length}. Rename the lenses or widen the pattern.`,
      );
    }

    return {
      session,
      lenses,
      totalLenses: allLenses.length,
      destroy: () => {
        try {
          session.destroy();
        } catch (err) {
          console.warn("[booth] camera kit teardown failed", err);
        }
      },
    };
  } catch (err) {
    console.warn("[booth] Camera Kit unavailable — falling back to the plain preview", err);
    return null;
  }
}
