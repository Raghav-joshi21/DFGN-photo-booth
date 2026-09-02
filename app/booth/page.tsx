"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

import { PhotoWall } from "@/components/booth/PhotoWall";
import { SelfCamera } from "@/components/booth/SelfCamera";
import { Clip } from "@/components/site/Clip";
import { FallingPotatoes } from "@/components/site/FallingPotatoes";
import { TopNav } from "@/components/site/TopNav";
import { useApprovedPhotos } from "@/lib/hooks/use-approved-photos";
import { useBoothStore } from "@/lib/stores/booth-store";

/**
 * Booth (kiosk) route.
 *
 * Screen switching is driven by `useBoothStore().screen`:
 *   - idle:   live camera on the left, photo wall + QR on the right
 *   - game:   AR mini-game (placeholder — see lib/ar)
 *
 * There is deliberately no separate camera screen: on a kiosk, making someone
 * press a button before the camera even turns on is a step for nothing. The
 * preview runs on the idle screen, so stepping up and hitting the countdown is
 * the whole interaction.
 *
 * The chrome lives here rather than in each screen so the header, ground and
 * backdrop stay put while the screens swap underneath.
 */
export default function BoothPage() {
  const screen = useBoothStore((s) => s.screen);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-cream font-body text-ink">
      <TopNav />

      <main className="relative flex flex-1 flex-col overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-10%,#fdf9f1_0%,#fbf4e8_45%,#e9eede_100%)]"
        />
        <FallingPotatoes />

        {screen === "game" ? <GameScreen /> : <IdleScreen />}
      </main>
    </div>
  );
}

function IdleScreen() {
  const { photos, loading, disabled } = useApprovedPhotos();

  // The QR points guests at THIS host's /upload. When the booth is opened via
  // the LAN URL, window.location.origin is already the right https://<ip>:port.
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);
  useEffect(() => {
    setUploadUrl(`${window.location.origin}/upload`);
  }, []);

  return (
    <div className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-5 py-8 lg:flex-row">
      {/* Camera — live from the moment the booth opens. */}
      <section className="flex w-full shrink-0 flex-col lg:w-[24rem] xl:w-[27rem]">
        <header className="mb-4 flex items-center gap-3">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border-[3px] border-brand-orange bg-cream-light">
            <Clip
              src="/art/potato-booth.mp4"
              poster="/art/potato-booth-poster.jpg"
              width={360}
              height={360}
              className="h-full w-full object-cover"
            />
          </div>
          <div>
            <h2 className="font-display text-2xl font-extrabold uppercase tracking-tight text-ink">
              Step up &amp; smile
            </h2>
            <p className="text-sm text-ink/60">Hit the countdown when you&apos;re ready.</p>
          </div>
        </header>

        <SelfCamera />
      </section>

      {/* Wall */}
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-baseline gap-3">
            <h1 className="text-shadow-brand font-display text-3xl font-extrabold uppercase tracking-tight text-ink sm:text-4xl">
              The Spud Wall
            </h1>
            <p className="text-sm font-semibold text-ink/50">
              {loading
                ? "loading…"
                : `${photos.length} spud${photos.length === 1 ? "" : "s"}`}
            </p>
          </div>

          {/* Compact so it sits beside the heading instead of stealing a column
              from the wall. */}
          <div className="flex items-center gap-3 rounded-2xl border-[3px] border-ink bg-cream-light px-3 py-2 shadow-[4px_4px_0_var(--color-ink)]">
            <div className="rounded-md bg-white p-1">
              {uploadUrl ? (
                <QRCodeSVG value={uploadUrl} size={64} marginSize={0} />
              ) : (
                // Reserve the box so the row doesn't jump once the URL resolves.
                <div className="h-16 w-16" />
              )}
            </div>
            <div className="max-w-[11rem]">
              <p className="font-display text-sm font-extrabold leading-tight text-ink">
                Or send one from your phone
              </p>
              <p className="mt-0.5 text-xs text-ink/60">
                Scan to add your selfie to the wall
              </p>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <PhotoWall photos={photos} loading={loading} disabled={disabled} />
        </div>
      </section>
    </div>
  );
}

function GameScreen() {
  const setScreen = useBoothStore((s) => s.setScreen);
  return (
    <div className="relative mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-5 px-5 py-8 text-center">
      <h2 className="text-shadow-brand font-display text-4xl font-extrabold uppercase tracking-tight text-ink">
        AR game
      </h2>
      <p className="text-base text-ink/70">
        Placeholder. The face-tracking &ldquo;catch the falling potatoes&rdquo;
        game mounts here — its logic lives in <code className="font-mono text-sm">lib/ar</code>.
      </p>
      <button
        onClick={() => setScreen("idle")}
        className="rounded-full border-[3px] border-ink bg-cream-light px-6 py-2.5 font-display font-bold text-ink shadow-[3px_3px_0_var(--color-ink)] transition-transform hover:-translate-y-0.5"
      >
        Back
      </button>
    </div>
  );
}
