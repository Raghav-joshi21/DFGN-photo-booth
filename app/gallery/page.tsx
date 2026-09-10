"use client";

import Image from "next/image";

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

        {/* Same bleeding-potato hero art as /home, pinned to the viewport
            (not `absolute` in the flow) so they stay in the corner instead of
            scrolling off with a tall photo wall. Fixed before PhotoWall in
            source order, so a card always paints over a potato at the edge
            rather than the other way round. PotatoBot is hidden on this page
            (`hideBot`), so bottom-right stays free — unlike home, no need to
            dodge it. */}
        <Image
          src="/art/potato-hero.png"
          alt=""
          aria-hidden
          width={392}
          height={348}
          className="pointer-events-none fixed -bottom-12 -left-14 hidden w-48 rotate-[-8deg] opacity-90 drop-shadow-lg lg:block xl:w-60"
        />
        <Image
          src="/art/potato-hero-alt.png"
          alt=""
          aria-hidden
          width={277}
          height={246}
          className="pointer-events-none fixed -top-8 -left-10 hidden w-32 rotate-[6deg] opacity-85 drop-shadow-md lg:block xl:w-40"
        />

        <div className="relative mx-auto w-full max-w-[112rem] px-3 py-8 sm:px-8 sm:py-12">
          <header className="relative mb-8 text-center">
            <IdfwSticker
              variant="star-maroon"
              rotate={-10}
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
