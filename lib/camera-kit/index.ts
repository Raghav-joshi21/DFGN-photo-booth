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
 * Potato-themed lenses lead the strip and one of them is applied by default —
 * this is a potato booth, so the potato look is the house style, not an option
 * buried at the end of a scroll. Non-matching lenses are still offered.
 */
const POTATO_LENS_PATTERN = /potato|spud|tater|tattie|fry|fries|chip|crisp|veg/i;

export interface CameraKitHandle {
  session: CameraKitSession;
  /** Every lens across all groups, potato-themed ones first. "No filter" is UI-side. */
  lenses: Lens[];
  /** The lens to apply on start-up — the first potato one, if any group has one. */
  defaultLens: Lens | null;
  /** Total lenses loaded, for diagnostics when nothing looks potato-ish. */
  totalLenses: number;
  destroy: () => void;
}

/**
 * Lens group id(s). `NEXT_PUBLIC_CAMERA_KIT_LENS_GROUP_ID` may hold a single id
 * or a comma-separated list — every listed group's lenses end up in one strip.
 */
export function lensGroupIds(): string[] {
  return (process.env.NEXT_PUBLIC_CAMERA_KIT_LENS_GROUP_ID ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

/** True when the API token and at least one lens group id are configured. */
export function hasCameraKitEnv(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CAMERA_KIT_API_TOKEN) && lensGroupIds().length > 0;
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

    const groupIds = lensGroupIds();
    const loaded = await cameraKit.lensRepository.loadLensGroups(groupIds);
    if (loaded.errors?.length) {
      console.warn("[booth] some lenses failed to load", loaded.errors);
    }

    // A lens can appear in more than one group, and a group can be listed
    // twice by mistake — collapse to one entry per id so the strip has no
    // duplicate chips.
    const seen = new Set<string>();
    const allLenses = loaded.lenses.filter((lens) =>
      seen.has(lens.id) ? false : (seen.add(lens.id), true),
    );

    const isPotato = (lens: Lens) => POTATO_LENS_PATTERN.test(lens.name);
    const potato = allLenses.filter(isPotato);

    // Every lens is offered — hiding the rest used to leave the strip empty
    // whenever the potato lens was named something unexpected. Potato ones
    // simply sort to the front, where the default selection lands.
    const lenses = [...potato, ...allLenses.filter((lens) => !isPotato(lens))];
    if (potato.length === 0 && allLenses.length > 0) {
      console.warn(
        `[booth] no lens in groups [${groupIds.join(", ")}] matched ${POTATO_LENS_PATTERN}; ` +
          `showing all ${allLenses.length} unsorted, with no filter applied by ` +
          `default. Rename the potato lens or widen the pattern.`,
      );
    }

    return {
      session,
      lenses,
      defaultLens: potato[0] ?? null,
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
