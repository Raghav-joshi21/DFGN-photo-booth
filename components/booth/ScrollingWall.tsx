"use client";

import { PotatoFrame } from "@/components/booth/PotatoFrame";
import type { Photo } from "@/types";

/**
 * The booth's wall: framed photos drifting bottom-to-top, forever.
 *
 * Deliberately wordless — it is ambient decoration on a kiosk, so headings and
 * empty-state copy would just be noise. Before the first guest it shows blank
 * frames, which reads as "photos go here" without saying it.
 *
 * The list is rendered twice and the track translated by -50%, so the second
 * copy arrives exactly where the first started and the loop never seams. Speed
 * scales with the number of photos, otherwise a full wall would race past.
 */
const PLACEHOLDER_COUNT = 4;
const SECONDS_PER_PHOTO = 7;

/** Deterministic small tilt per photo, so the wall looks hand-pinned. */
function tiltFor(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(hash) % 900) / 100) - 4.5;
}

export function ScrollingWall({ photos }: { photos: Photo[] }) {
  const hasPhotos = photos.length > 0;
  const items = hasPhotos ? photos : Array.from({ length: PLACEHOLDER_COUNT });
  const duration = Math.max(24, items.length * SECONDS_PER_PHOTO);

  // Two passes of the same list: the marquee needs a duplicate to scroll into.
  const track = [...items, ...items];

  return (
    <div
      aria-hidden
      className="relative h-full overflow-hidden"
      // Fade the ends so frames enter and leave instead of being chopped off
      // by a hard edge.
      style={{
        maskImage:
          "linear-gradient(to bottom, transparent, black 8%, black 92%, transparent)",
        WebkitMaskImage:
          "linear-gradient(to bottom, transparent, black 8%, black 92%, transparent)",
      }}
    >
      <div
        className="wall-scroll flex flex-col gap-6 px-2.5"
        style={{ animationDuration: `${duration}s` }}
      >
        {track.map((item, i) => {
          const photo = hasPhotos ? (item as Photo) : undefined;
          return (
            <PotatoFrame
              key={photo ? `${photo.id}-${i}` : `placeholder-${i}`}
              photo={photo}
              rotation={photo ? tiltFor(photo.id) : (i % 2 ? 2 : -2)}
            />
          );
        })}
      </div>
    </div>
  );
}
