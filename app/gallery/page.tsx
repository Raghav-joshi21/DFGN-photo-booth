"use client";

import { PhotoWall } from "@/components/booth/PhotoWall";
import { PotatoBot } from "@/components/site/PotatoBot";
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
      <TopNav />

      <main className="relative flex-1">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-10%,#fdf9f1_0%,#fbf4e8_45%,#e9eede_100%)]"
        />

        <div className="relative mx-auto w-full max-w-6xl px-5 py-10 sm:py-14">
          <header className="mb-8 text-center">
            <h1 className="text-shadow-brand font-display text-4xl font-extrabold uppercase tracking-tight text-ink sm:text-5xl">
              IDFW Gallery
            </h1>
            <p className="mt-3 text-base text-ink/70">
              {loading
                ? "Digging up the spuds…"
                : `${photos.length} spud${photos.length === 1 ? "" : "s"} on the wall.`}
            </p>
          </header>

          <PhotoWall photos={photos} loading={loading} disabled={disabled} />
        </div>
      </main>

      <PotatoBot />
    </div>
  );
}
