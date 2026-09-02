import Image from "next/image";

import type { Photo } from "@/types";

/**
 * Shared photo tile used on the booth wall (and reusable elsewhere).
 *
 * Prefers the AI-stylized `editedUrl` when available, falling back to the
 * original capture/upload. Kept dependency-light and presentational so it can
 * be dropped into any layout.
 */
export function PhotoCard({ photo }: { photo: Photo }) {
  const src = photo.editedUrl ?? photo.originalUrl;

  return (
    <figure className="relative aspect-square overflow-hidden rounded-2xl bg-foreground/5">
      <Image
        src={src}
        alt={`${photo.source} photo`}
        fill
        sizes="(max-width: 768px) 50vw, 25vw"
        className="object-cover"
        unoptimized
      />
    </figure>
  );
}
