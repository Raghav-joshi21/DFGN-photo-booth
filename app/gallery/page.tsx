"use client";

import { PhotoWall } from "@/components/booth/PhotoWall";
import { IdfwSticker } from "@/components/site/IdfwSticker";
import { TopNav } from "@/components/site/TopNav";
import { useApprovedPhotos } from "@/lib/hooks/use-approved-photos";

/**
 * Public gallery — the same live wall the booth shows, on its own route so the
 * header's "Gallery" link has somewhere to go and guests can browse on a phone.
 *
 * Reuses PhotoWall and the Realtime-backed useApprovedPhotos hook, so approved
 * photos land here the moment they're approved, exactly as on the booth screen.
 */
export default function GalleryPage() {
  const { photos, loading, disabled } = useApprovedPhotos();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-cream font-body text-ink">
      <TopNav hideBot />

      <main className="relative flex-1">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-10%,#fdf9f1_0%,#fbf4e8_45%,#e9eede_100%)]"
        />

        <div className="relative mx-auto w-full max-w-[112rem] px-3 py-8 sm:px-8 sm:py-12">
          <header className="relative mb-8 text-center">
            <IdfwSticker
              variant="star-maroon"
              rotate={-10}
              aria-hidden
              className="pointer-events-none absolute left-[calc(50%-9.5rem)] top-1 hidden h-8 w-8 sm:block sm:left-[calc(50%-13rem)] sm:h-10 sm:w-10"
            />
            <h1 className="text-shadow-brand font-display text-4xl font-extrabold uppercase tracking-tight text-ink sm:text-5xl">
              IDFW Gallery
            </h1>
            <IdfwSticker
              variant="oak-leaf"
              rotate={16}
              className="pointer-events-none absolute right-[calc(50%-9.5rem)] top-0 hidden h-10 w-10 sm:block sm:right-[calc(50%-13rem)] sm:h-12 sm:w-12"
            />
            <p className="mt-3 text-base text-ink/70">
              {loading
                ? "Digging up the spuds…"
                : `${photos.length} spud${photos.length === 1 ? "" : "s"} on the wall.`}
            </p>
          </header>

          <PhotoWall photos={photos} loading={loading} disabled={disabled} />
        </div>
      </main>
    </div>
  );
}
