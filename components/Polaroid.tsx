import Image from "next/image";

import type { Photo } from "@/types";

/**
 * A single Polaroid-style photo: white frame, image up top, a chunky caption
 * strip at the bottom. Presentational — the parent decides tilt/placement.
 */
export function Polaroid({
  photo,
  rotation = 0,
}: {
  photo: Photo;
  rotation?: number;
}) {
  const src = photo.editedUrl ?? photo.originalUrl;

  return (
    <div
      className="w-full rounded-[6px] bg-white p-3 pb-10 shadow-xl shadow-black/30 ring-1 ring-black/5"
      style={{ rotate: `${rotation}deg` }}
    >
      <div className="relative aspect-square overflow-hidden bg-neutral-200">
        <Image
          src={src}
          alt={`${photo.source} photo`}
          fill
          sizes="(max-width: 768px) 40vw, 20vw"
          className="object-cover"
          unoptimized
        />
      </div>
    </div>
  );
}
